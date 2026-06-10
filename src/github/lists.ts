import axios from "axios";
import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import type { EntryType } from "../utils/validation";
import { getFileIfExists, updateFile } from "./files";

const CONFLICT_MAX_ATTEMPTS = 3;

export type AddToListResult =
  | { status: "file_not_found"; fileName: string }
  | { status: "already_exists"; fileName: string; value: string; type: EntryType }
  | {
      status: "added";
      fileName: string;
      value: string;
      type: EntryType;
      changes: string[];
    };

export type AddManyToListResult =
  | { status: "file_not_found"; fileName: string }
  | {
      status: "all_exist";
      fileName: string;
      type: EntryType;
      skipped: string[];
    }
  | {
      status: "added";
      fileName: string;
      type: EntryType;
      added: string[];
      skipped: string[];
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

    const parts = trimmed.includes(",")
      ? trimmed.split(",").map((part) => part.trim())
      : [trimmed];

    for (const part of parts) {
      if (part) {
        entries.push(part);
      }
    }
  }

  return entries;
}

function prepareEntriesForWrite(entries: string[], type: EntryType): string[] {
  if (type !== "domain") {
    return entries;
  }

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const entry of entries) {
    const normalized = entry.toLowerCase();

    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(normalized);
    }
  }

  unique.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  return unique;
}

function serializeList(entries: string[]): string {
  if (entries.length === 0) return "";

  return entries.map((entry) => entry.trim()).join("\n").concat("\n");
}

function entryExists(
  entries: string[],
  value: string,
  type: EntryType,
): boolean {
  return entries.some((entry) =>
    type === "domain"
      ? entry.toLowerCase() === value.toLowerCase()
      : entry === value,
  );
}

function isConflictError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409;
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

  const entries = parseListContent(file.content).map((entry) =>
    normalizeEntryValue(entry, type),
  );
  const added: string[] = [];
  const skipped: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizeEntryValue(value, type);

    if (entryExists(entries, normalizedValue, type)) {
      skipped.push(normalizedValue);
      continue;
    }

    entries.push(normalizedValue);
    added.push(normalizedValue);
  }

  const prepared = prepareEntriesForWrite(entries, type);
  const newContent = serializeList(prepared);

  if (added.length === 0) {
    if (newContent !== file.content) {
      await updateFile(
        fileName,
        newContent,
        file.sha,
        type === "domain" ? "Normalize domain list" : "Normalize IP list",
      );
    }

    return { status: "all_exist", fileName, type, skipped };
  }

  const commitLabel = type === "domain" ? "domain" : "IP";
  const commitSummary =
    added.length === 1
      ? added[0]
      : type === "domain"
        ? `${added.length} domains: ${added.join(", ")}`
        : `${added.length} IPs: ${added.join(", ")}`;

  await updateFile(
    fileName,
    newContent,
    file.sha,
    `Add ${commitLabel}: ${commitSummary}`,
  );

  return {
    status: "added",
    fileName,
    type,
    added,
    skipped,
    changes: added.map((value) => `+ ${value}`),
  };
}

export async function addManyToList(
  type: EntryType,
  values: string[],
): Promise<AddManyToListResult> {
  for (let attempt = 1; attempt <= CONFLICT_MAX_ATTEMPTS; attempt++) {
    try {
      return await addManyToListOnce(type, values);
    } catch (error) {
      if (isConflictError(error) && attempt < CONFLICT_MAX_ATTEMPTS) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("addManyToList: unreachable");
}

export async function addToList(
  type: EntryType,
  value: string,
): Promise<AddToListResult> {
  const result = await addManyToList(type, [value]);

  switch (result.status) {
    case "file_not_found":
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
