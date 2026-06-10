import { isIP } from "node:net";

export type EntryType = "domain" | "ip";

const DOMAIN_REGEX =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export function isValidDomain(value: string): boolean {
  if (value.length > 253) return false;
  return DOMAIN_REGEX.test(value);
}

export function isValidIp(value: string): boolean {
  return isIP(value) !== 0;
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

