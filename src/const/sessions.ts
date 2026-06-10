export const SESSION_STEP = {
  AWAITING_ENTRY: "awaiting_entry",
} as const;

export const SESSION_DATA_KEY = {
  PENDING_TYPE: "pendingType",
  PENDING_VALUES: "pendingValues",
  PENDING_ACTION_ID: "pendingActionId",
  PENDING_MESSAGE_ID: "pendingMessageId",
} as const;

export const ENTRY_ACTION = {
  ADD: "add",
  DISABLE: "disable",
  DELETE: "delete",
} as const;

export type EntryAction = (typeof ENTRY_ACTION)[keyof typeof ENTRY_ACTION];
