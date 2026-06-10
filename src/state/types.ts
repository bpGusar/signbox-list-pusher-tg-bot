import type { EntryType } from "../utils/types";

export type SessionStep = string;

export type Session = {
  step: SessionStep;
  data?: Record<string, string>;
};

export type PendingEntries = {
  actionId: string;
  type: EntryType;
  values: string[];
};

export type PendingDisabledEntries = {
  actionId: string;
  type: EntryType;
  values: string[];
};
