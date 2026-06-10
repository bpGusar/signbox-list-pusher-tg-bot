import {
  DISABLED_ENTRY_ACTION,
  DUPLICATE_RESOLUTION,
  ENTRY_ACTION,
} from "./sessions";

export type DuplicateResolutionStrategy =
  (typeof DUPLICATE_RESOLUTION)[keyof typeof DUPLICATE_RESOLUTION];

export type EntryAction = (typeof ENTRY_ACTION)[keyof typeof ENTRY_ACTION];

export type DisabledEntryAction =
  (typeof DISABLED_ENTRY_ACTION)[keyof typeof DISABLED_ENTRY_ACTION];
