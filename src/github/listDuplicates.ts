import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import type { DuplicateResolutionStrategy } from "../const/sessions";
import type { EntryType } from "../utils/validation";
import { getFileIfExists, updateFile } from "./files";

export type DuplicateGroup = {
  value: string;
  lines: string[];
};

export type ListDuplicatesReport = {
  fileName: string;
  type: EntryType;
  groups: DuplicateGroup[];
};

function getListFileName(type: EntryType): string {
  return type === "domain" ? DOMAIN_LIST_FILE : IP_LIST_FILE;
}

function normalizeEntryValue(value: string, type: EntryType): string {
  return type === "domain" ? value.toLowerCase() : value;
}

function stripDisablePrefix(entry: string): string {
  const match = entry.match(/^\s*\/\/\s*(.+)$/);
  return match ? match[1].trim() : entry.trim();
}

function isDisabledEntry(entry: string): boolean {
  return /^\s*\/\//.test(entry);
}

function parseListContent(content: string): string[] {
  const entries: string[] = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    entries.push(trimmed);
  }

  return entries;
}

function serializeList(entries: string[]): string {
  if (entries.length === 0) return "";

  return entries.map((entry) => entry.trim()).join("\n").concat("\n");
}

export function findDuplicateGroups(
  entries: string[],
  type: EntryType,
): DuplicateGroup[] {
  const groups = new Map<string, string[]>();

  for (const entry of entries) {
    const key = normalizeEntryValue(stripDisablePrefix(entry), type);
    const lines = groups.get(key) ?? [];
    lines.push(entry);
    groups.set(key, lines);
  }

  return [...groups.entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([value, lines]) => ({ value, lines }));
}

export async function findListDuplicates(
  type: EntryType,
): Promise<ListDuplicatesReport | null> {
  const fileName = getListFileName(type);
  const file = await getFileIfExists(fileName);

  if (!file) {
    return null;
  }

  const groups = findDuplicateGroups(parseListContent(file.content), type);

  if (groups.length === 0) {
    return null;
  }

  return { fileName, type, groups };
}

export async function findAllListDuplicates(): Promise<ListDuplicatesReport[]> {
  const reports: ListDuplicatesReport[] = [];

  for (const type of ["domain", "ip"] as const) {
    const report = await findListDuplicates(type);

    if (report) {
      reports.push(report);
    }
  }

  return reports;
}

function resolveDuplicateEntries(
  entries: string[],
  type: EntryType,
  strategy: DuplicateResolutionStrategy,
): string[] {
  const grouped = new Map<string, { index: number; entry: string }[]>();

  entries.forEach((entry, index) => {
    const key = normalizeEntryValue(stripDisablePrefix(entry), type);
    const items = grouped.get(key) ?? [];
    items.push({ index, entry });
    grouped.set(key, items);
  });

  const indicesToKeep = new Set<number>();

  for (const items of grouped.values()) {
    if (items.length === 1) {
      indicesToKeep.add(items[0]!.index);
      continue;
    }

    let keeper = items[0]!;

    if (strategy === "keep_last") {
      keeper = items[items.length - 1]!;
    } else if (strategy === "keep_active") {
      keeper = items.find((item) => !isDisabledEntry(item.entry)) ?? items[0]!;
    }

    indicesToKeep.add(keeper.index);
  }

  return entries.filter((_, index) => indicesToKeep.has(index));
}

export async function resolveListDuplicates(
  type: EntryType,
  strategy: DuplicateResolutionStrategy,
): Promise<
  | { status: "file_not_found"; fileName: string }
  | { status: "no_duplicates"; fileName: string }
  | {
      status: "resolved";
      fileName: string;
      removedCount: number;
      strategy: DuplicateResolutionStrategy;
    }
> {
  const fileName = getListFileName(type);
  const file = await getFileIfExists(fileName);

  if (!file) {
    return { status: "file_not_found", fileName };
  }

  const entries = parseListContent(file.content);
  const groups = findDuplicateGroups(entries, type);

  if (groups.length === 0) {
    return { status: "no_duplicates", fileName };
  }

  const resolved = resolveDuplicateEntries(entries, type, strategy);
  const removedCount = entries.length - resolved.length;
  const newContent = serializeList(resolved);

  if (newContent === file.content) {
    return { status: "no_duplicates", fileName };
  }

  const commitMessage =
    type === "domain"
      ? `Resolve duplicate domains (${strategy})`
      : `Resolve duplicate IPs (${strategy})`;

  await updateFile(fileName, newContent, file.sha, commitMessage);

  return {
    status: "resolved",
    fileName,
    removedCount,
    strategy,
  };
}
