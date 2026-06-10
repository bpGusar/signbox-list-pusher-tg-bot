import { isIP } from "node:net";

export type EntryType = "domain" | "ip";

const DOMAIN_REGEX =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export function isValidDomain(value: string): boolean {
  if (value.length > 253) return false;
  return DOMAIN_REGEX.test(value);
}

function isValidCidr(value: string): boolean {
  const parts = value.split("/");

  if (parts.length !== 2) {
    return false;
  }

  const [ipPart, prefixPart] = parts;

  if (!ipPart || !prefixPart) {
    return false;
  }

  const ipVersion = isIP(ipPart);

  if (ipVersion === 0) {
    return false;
  }

  if (!/^\d+$/.test(prefixPart)) {
    return false;
  }

  const prefix = Number(prefixPart);
  const maxPrefix = ipVersion === 4 ? 32 : 128;

  return prefix >= 0 && prefix <= maxPrefix;
}

export function isValidIp(value: string): boolean {
  return isIP(value) !== 0 || isValidCidr(value);
}

export function parseEntry(
  raw: string,
): { type: EntryType; value: string } | null {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.includes("://") || /\s/.test(trimmed)) {
    return null;
  }

  if (isValidIp(trimmed)) {
    return { type: "ip", value: trimmed };
  }

  const normalizedDomain = trimmed.toLowerCase();

  if (isValidDomain(normalizedDomain)) {
    return { type: "domain", value: normalizedDomain };
  }

  return null;
}

export type ParsedEntries =
  | { ok: true; type: EntryType; values: string[] }
  | { ok: false; reason: "empty" | "mixed_types" | "invalid"; invalid: string[] };

function parseSinglePart(raw: string): { type: EntryType; value: string } | null {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.includes("://")) {
    return null;
  }

  return parseEntry(trimmed);
}

export function parseEntries(raw: string): ParsedEntries {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, reason: "empty", invalid: [] };
  }

  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    return { ok: false, reason: "invalid", invalid: [trimmed] };
  }

  const parts = trimmed.split(",").map((part) => part.trim());

  if (parts.some((part) => !part)) {
    return { ok: false, reason: "empty", invalid: [] };
  }

  const parsed = parts.map((part) => ({ part, entry: parseSinglePart(part) }));
  const invalid = parsed.filter((item) => item.entry === null).map((item) => item.part);

  if (invalid.length > 0) {
    return { ok: false, reason: "invalid", invalid };
  }

  const entries = parsed.map((item) => item.entry!);
  const types = new Set(entries.map((entry) => entry.type));

  if (types.size > 1) {
    return { ok: false, reason: "mixed_types", invalid: [] };
  }

  const type = entries[0]!.type;
  const uniqueValues: string[] = [];

  for (const entry of entries) {
    if (!uniqueValues.includes(entry.value)) {
      uniqueValues.push(entry.value);
    }
  }

  return { ok: true, type, values: uniqueValues };
}

