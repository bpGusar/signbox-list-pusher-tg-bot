export const SESSION_STEP = {
  AWAITING_ENTRY: "awaiting_entry",
  AWAITING_DUPLICATE_RESOLUTION: "awaiting_duplicate_resolution",
  AWAITING_DISABLED_RESOLUTION: "awaiting_disabled_resolution",
  CHECK_FAILED: "check_failed",
} as const;

export const SESSION_DATA_KEY = {
  PENDING_TYPE: "pendingType",
  PENDING_VALUES: "pendingValues",
  PENDING_ACTION_ID: "pendingActionId",
  PENDING_MESSAGE_ID: "pendingMessageId",
  PENDING_DISABLED_TYPE: "pendingDisabledType",
  PENDING_DISABLED_VALUES: "pendingDisabledValues",
  PENDING_DISABLED_ACTION_ID: "pendingDisabledActionId",
  LAST_CHECK_TEXT: "lastCheckText",
  CHECK_PASSED: "checkPassed",
  KEYBOARD_ACTIVE: "keyboardActive",
} as const;

export const CALLBACK_DATA = {
  RETRY_CHECK: "check:retry",
} as const;

export const DUPLICATE_RESOLUTION = {
  KEEP_FIRST: "keep_first",
  KEEP_LAST: "keep_last",
  KEEP_ACTIVE: "keep_active",
} as const;

export type DuplicateResolutionStrategy =
  (typeof DUPLICATE_RESOLUTION)[keyof typeof DUPLICATE_RESOLUTION];

export const ENTRY_ACTION = {
  ADD: "add",
  DISABLE: "disable",
  DELETE: "delete",
} as const;

export type EntryAction = (typeof ENTRY_ACTION)[keyof typeof ENTRY_ACTION];

export const DISABLED_ENTRY_ACTION = {
  ENABLE: "enable",
  DELETE: "delete",
} as const;

export type DisabledEntryAction =
  (typeof DISABLED_ENTRY_ACTION)[keyof typeof DISABLED_ENTRY_ACTION];
