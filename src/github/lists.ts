import axios from "axios";
import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import {
  findDuplicateGroups,
  type DuplicateGroup,
} from "./listDuplicates";
import type { EntryType } from "../utils/validation";
import { getFileIfExists, updateFile } from "./files";

const CONFLICT_MAX_ATTEMPTS = 3;

export type AddToListResult =
  | { status: "file_not_found"; fileName: string }
  | DuplicatesInFileResult
  | { status: "already_exists"; fileName: string; value: string; type: EntryType }
  | {
      status: "added";
      fileName: string;
      value: string;
      type: EntryType;
      changes: string[];
    };

export type DuplicatesInFileResult = {
  status: "duplicates_in_file";
  fileName: string;
  type: EntryType;
  groups: DuplicateGroup[];
};

export type AddManyToListResult =
  | { status: "file_not_found"; fileName: string }
  | DuplicatesInFileResult
  | {
      status: "all_exist";
      fileName: string;
      type: EntryType;
      skipped: string[];
      disabledInFile: string[];
    }
  | {
      status: "added";
      fileName: string;
      type: EntryType;
      added: string[];
      skipped: string[];
      disabledInFile: string[];
      changes: string[];
    };

export type ModifyManyInListResult =
  | { status: "file_not_found"; fileName: string }
  | DuplicatesInFileResult
  | {
      status: "no_changes";
      fileName: string;
      type: EntryType;
      skipped: string[];
      notFound: string[];
    }
  | {
      status: "modified";
      fileName: string;
      type: EntryType;
      affected: string[];
      skipped: string[];
      notFound: string[];
      changes: string[];
    };

function getListFileName(type: EntryType): string {
  return type === "domain" ? DOMAIN_LIST_FILE : IP_LIST_FILE;
}

function normalizeEntryValue(value: string, type: EntryType): string {
  return type === "domain" ? value.toLowerCase() : value;
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

function stripDisablePrefix(entry: string): string {
  const match = entry.match(/^\s*\/\/\s*(.+)$/);
  return match ? match[1].trim() : entry.trim();
}

function isDisabledEntry(entry: string): boolean {
  return /^\s*\/\//.test(entry);
}

function entriesMatch(
  entry: string,
  value: string,
  type: EntryType,
): boolean {
  const strippedEntry = stripDisablePrefix(entry);
  const normalizedEntry = normalizeEntryValue(strippedEntry, type);
  const normalizedValue = normalizeEntryValue(value, type);
  return normalizedEntry === normalizedValue;
}

function findEntryIndex(
  entries: string[],
  value: string,
  type: EntryType,
): number {
  return entries.findIndex((entry) => entriesMatch(entry, value, type));
}

function formatDisabledEntry(value: string, type: EntryType): string {
  return `// ${normalizeEntryValue(value, type)}`;
}

async function withConflictRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= CONFLICT_MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (isConflictError(error) && attempt < CONFLICT_MAX_ATTEMPTS) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("withConflictRetry: unreachable");
}

function isConflictError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409;
}

function getDuplicatesInFileResult(
  fileName: string,
  type: EntryType,
  entries: string[],
): DuplicatesInFileResult | null {
  const groups = findDuplicateGroups(entries, type);

  if (groups.length === 0) {
    return null;
  }

  return { status: "duplicates_in_file", fileName, type, groups };
}

async function addManyToListOnce(
  type: EntryType,
  values: string[],
): Promise<AddManyToListResult> {
  const fileName = getListFileName(type);
  const file = await getFileIfExists(fileName);

  if (!file) {
    return { status: "file_not_found", fileName };
  }

  const entries = parseListContent(file.content);
  const duplicatesResult = getDuplicatesInFileResult(fileName, type, entries);

  if (duplicatesResult) {
    return duplicatesResult;
  }

  const added: string[] = [];
  const skipped: string[] = [];
  const disabledInFile: string[] = [];
  const changes: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizeEntryValue(value, type);
    const index = findEntryIndex(entries, normalizedValue, type);

    if (index === -1) {
      entries.push(normalizedValue);
      added.push(normalizedValue);
      changes.push(`+ ${normalizedValue}`);
      continue;
    }

    const current = entries[index];

    if (isDisabledEntry(current)) {
      disabledInFile.push(normalizedValue);
      continue;
    }

    skipped.push(normalizedValue);
  }

  const newContent = serializeList(entries);

  if (added.length === 0) {
    return { status: "all_exist", fileName, type, skipped, disabledInFile };
  }

  const commitMessage =
    type === "domain"
      ? `Add ${added.length} domain${added.length === 1 ? "" : "s"}`
      : `Add ${added.length} IP${added.length === 1 ? "" : "s"}`;

  await updateFile(fileName, newContent, file.sha, commitMessage);

  return {
    status: "added",
    fileName,
    type,
    added,
    skipped,
    disabledInFile,
    changes,
  };
}

export async function addManyToList(
  type: EntryType,
  values: string[],
): Promise<AddManyToListResult> {
  return withConflictRetry(() => addManyToListOnce(type, values));
}

async function disableManyInListOnce(
  type: EntryType,
  values: string[],
): Promise<ModifyManyInListResult> {
  const fileName = getListFileName(type);
  const file = await getFileIfExists(fileName);

  if (!file) {
    return { status: "file_not_found", fileName };
  }

  const entries = parseListContent(file.content);
  const duplicatesResult = getDuplicatesInFileResult(fileName, type, entries);

  if (duplicatesResult) {
    return duplicatesResult;
  }

  const affected: string[] = [];
  const skipped: string[] = [];
  const notFound: string[] = [];
  const changes: string[] = [];

  for (const value of values) {
    const index = findEntryIndex(entries, value, type);

    if (index === -1) {
      notFound.push(normalizeEntryValue(value, type));
      continue;
    }

    const current = entries[index];

    if (isDisabledEntry(current)) {
      skipped.push(normalizeEntryValue(value, type));
      continue;
    }

    const normalizedValue = normalizeEntryValue(
      stripDisablePrefix(current),
      type,
    );
    const disabledEntry = formatDisabledEntry(normalizedValue, type);
    entries[index] = disabledEntry;
    affected.push(normalizedValue);
    changes.push(`~ ${normalizedValue} → ${disabledEntry}`);
  }

  if (affected.length === 0) {
    return { status: "no_changes", fileName, type, skipped, notFound };
  }

  const newContent = serializeList(entries);
  const commitMessage =
    type === "domain"
      ? `Disable ${affected.length} domain${affected.length === 1 ? "" : "s"}`
      : `Disable ${affected.length} IP${affected.length === 1 ? "" : "s"}`;

  await updateFile(fileName, newContent, file.sha, commitMessage);

  return {
    status: "modified",
    fileName,
    type,
    affected,
    skipped,
    notFound,
    changes,
  };
}

async function enableManyInListOnce(
  type: EntryType,
  values: string[],
): Promise<ModifyManyInListResult> {
  const fileName = getListFileName(type);
  const file = await getFileIfExists(fileName);

  if (!file) {
    return { status: "file_not_found", fileName };
  }

  const entries = parseListContent(file.content);
  const duplicatesResult = getDuplicatesInFileResult(fileName, type, entries);

  if (duplicatesResult) {
    return duplicatesResult;
  }

  const affected: string[] = [];
  const skipped: string[] = [];
  const notFound: string[] = [];
  const changes: string[] = [];

  for (const value of values) {
    const index = findEntryIndex(entries, value, type);

    if (index === -1) {
      notFound.push(normalizeEntryValue(value, type));
      continue;
    }

    const current = entries[index];

    if (!isDisabledEntry(current)) {
      skipped.push(normalizeEntryValue(value, type));
      continue;
    }

    const normalizedValue = normalizeEntryValue(
      stripDisablePrefix(current),
      type,
    );
    entries[index] = normalizedValue;
    affected.push(normalizedValue);
    changes.push(
      `~ ${formatDisabledEntry(normalizedValue, type)} → ${normalizedValue}`,
    );
  }

  if (affected.length === 0) {
    return { status: "no_changes", fileName, type, skipped, notFound };
  }

  const newContent = serializeList(entries);
  const commitMessage =
    type === "domain"
      ? `Enable ${affected.length} domain${affected.length === 1 ? "" : "s"}`
      : `Enable ${affected.length} IP${affected.length === 1 ? "" : "s"}`;

  await updateFile(fileName, newContent, file.sha, commitMessage);

  return {
    status: "modified",
    fileName,
    type,
    affected,
    skipped,
    notFound,
    changes,
  };
}

async function removeManyFromListOnce(
  type: EntryType,
  values: string[],
): Promise<ModifyManyInListResult> {
  const fileName = getListFileName(type);
  const file = await getFileIfExists(fileName);

  if (!file) {
    return { status: "file_not_found", fileName };
  }

  const entries = parseListContent(file.content);
  const duplicatesResult = getDuplicatesInFileResult(fileName, type, entries);

  if (duplicatesResult) {
    return duplicatesResult;
  }

  const affected: string[] = [];
  const notFound: string[] = [];
  const changes: string[] = [];

  for (const value of values) {
    const index = findEntryIndex(entries, value, type);

    if (index === -1) {
      notFound.push(normalizeEntryValue(value, type));
      continue;
    }

    const removed = normalizeEntryValue(
      stripDisablePrefix(entries[index]),
      type,
    );
    entries.splice(index, 1);
    affected.push(removed);
    changes.push(`- ${removed}`);
  }

  if (affected.length === 0) {
    return {
      status: "no_changes",
      fileName,
      type,
      skipped: [],
      notFound,
    };
  }

  const newContent = serializeList(entries);
  const commitMessage =
    type === "domain"
      ? `Remove ${affected.length} domain${affected.length === 1 ? "" : "s"}`
      : `Remove ${affected.length} IP${affected.length === 1 ? "" : "s"}`;

  await updateFile(fileName, newContent, file.sha, commitMessage);

  return {
    status: "modified",
    fileName,
    type,
    affected,
    skipped: [],
    notFound,
    changes,
  };
}

export async function enableManyInList(
  type: EntryType,
  values: string[],
): Promise<ModifyManyInListResult> {
  return withConflictRetry(() => enableManyInListOnce(type, values));
}

export async function disableManyInList(
  type: EntryType,
  values: string[],
): Promise<ModifyManyInListResult> {
  return withConflictRetry(() => disableManyInListOnce(type, values));
}

export async function removeManyFromList(
  type: EntryType,
  values: string[],
): Promise<ModifyManyInListResult> {
  return withConflictRetry(() => removeManyFromListOnce(type, values));
}

export async function addToList(
  type: EntryType,
  value: string,
): Promise<AddToListResult> {
  const result = await addManyToList(type, [value]);

  switch (result.status) {
    case "file_not_found":
      return result;
    case "duplicates_in_file":
      return result;
    case "all_exist":
      return { status: "already_exists", fileName: result.fileName, value, type };
    case "added":
      return {
        status: "added",
        fileName: result.fileName,
        value,
        type,
        changes: result.changes,
      };
  }
}
