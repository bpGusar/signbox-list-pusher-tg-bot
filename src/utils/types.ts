export type EntryType = "domain" | "ip";

export type ParsedEntries =
  | { ok: true; type: EntryType; values: string[] }
  | {
      ok: false;
      reason: "empty" | "mixed_types" | "invalid";
      invalid: string[];
    };
