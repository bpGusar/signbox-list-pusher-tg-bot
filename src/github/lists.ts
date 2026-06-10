import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import type { EntryType } from "../utils/validation";
import { getFileIfExists, updateFile } from "./files";

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

function getListFileName(type: EntryType): string {
  return type === "domain" ? DOMAIN_LIST_FILE : IP_LIST_FILE;
}

function parseListContent(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function serializeList(entries: string[]): string {
  if (entries.length === 0) return "";
  return `${entries.join("\n")}\n`;
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

export async function addToList(
  type: EntryType,
  value: string,
): Promise<AddToListResult> {
  const fileName = getListFileName(type);
  const file = await getFileIfExists(fileName);

  if (!file) {
    return { status: "file_not_found", fileName };
  }

  const entries = parseListContent(file.content);

  if (entryExists(entries, value, type)) {
    return { status: "already_exists", fileName, value, type };
  }

  entries.push(value);

  if (type === "domain") {
    entries.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }

  const newContent = serializeList(entries);

  await updateFile(
    fileName,
    newContent,
    file.sha,
    `Add ${type === "domain" ? "domain" : "IP"}: ${value}`,
  );

  return {
    status: "added",
    fileName,
    value,
    type,
    changes: [`+ ${value}`],
  };
}
