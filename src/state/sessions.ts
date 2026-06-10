import { randomBytes } from "node:crypto";
import {
  SESSION_DATA_KEY,
  SESSION_STEP,
  type DisabledEntryAction,
  type EntryAction,
} from "../const/sessions";
import type { EntryType } from "../utils/validation";

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

const sessions = new Map<number, Session>();
const consumedActionIds = new Set<string>();

export function setSession(
  chatId: number,
  step: SessionStep,
  data?: Record<string, string>,
) {
  sessions.set(chatId, { step, data });
}

export function getSession(chatId: number) {
  return sessions.get(chatId);
}

export function clearSession(chatId: number) {
  sessions.delete(chatId);
}

export function getPendingMessageId(session: Session | undefined): number | null {
  const raw = session?.data?.[SESSION_DATA_KEY.PENDING_MESSAGE_ID];

  if (!raw) {
    return null;
  }

  const messageId = Number(raw);
  return Number.isInteger(messageId) ? messageId : null;
}

export function setPendingEntries(
  chatId: number,
  type: EntryType,
  values: string[],
): string {
  const actionId = randomBytes(4).toString("hex");
  const current = getSession(chatId);

  setSession(chatId, SESSION_STEP.AWAITING_ENTRY, {
    ...current?.data,
    [SESSION_DATA_KEY.PENDING_TYPE]: type,
    [SESSION_DATA_KEY.PENDING_VALUES]: JSON.stringify(values),
    [SESSION_DATA_KEY.PENDING_ACTION_ID]: actionId,
    [SESSION_DATA_KEY.PENDING_MESSAGE_ID]:
      current?.data?.[SESSION_DATA_KEY.PENDING_MESSAGE_ID] ?? "",
  });

  return actionId;
}

export function setPendingMessageId(chatId: number, messageId: number) {
  const current = getSession(chatId);

  if (!current) {
    return;
  }

  setSession(chatId, current.step, {
    ...current.data,
    [SESSION_DATA_KEY.PENDING_MESSAGE_ID]: String(messageId),
  });
}

export function getPendingEntries(session: Session): PendingEntries | null {
  const type = session.data?.[SESSION_DATA_KEY.PENDING_TYPE] as
    | EntryType
    | undefined;
  const valuesJson = session.data?.[SESSION_DATA_KEY.PENDING_VALUES];
  const actionId = session.data?.[SESSION_DATA_KEY.PENDING_ACTION_ID];

  if (!type || !valuesJson || !actionId) {
    return null;
  }

  try {
    const values = JSON.parse(valuesJson) as string[];

    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }

    return { actionId, type, values };
  } catch {
    return null;
  }
}

export function setPendingDisabledEntries(
  chatId: number,
  type: EntryType,
  values: string[],
): string {
  const actionId = randomBytes(4).toString("hex");
  const current = getSession(chatId);

  setSession(chatId, SESSION_STEP.AWAITING_DISABLED_RESOLUTION, {
    ...current?.data,
    [SESSION_DATA_KEY.PENDING_DISABLED_TYPE]: type,
    [SESSION_DATA_KEY.PENDING_DISABLED_VALUES]: JSON.stringify(values),
    [SESSION_DATA_KEY.PENDING_DISABLED_ACTION_ID]: actionId,
  });

  return actionId;
}

export function getPendingDisabledEntries(
  session: Session,
): PendingDisabledEntries | null {
  const type = session.data?.[SESSION_DATA_KEY.PENDING_DISABLED_TYPE] as
    | EntryType
    | undefined;
  const valuesJson = session.data?.[SESSION_DATA_KEY.PENDING_DISABLED_VALUES];
  const actionId = session.data?.[SESSION_DATA_KEY.PENDING_DISABLED_ACTION_ID];

  if (!type || !valuesJson || !actionId) {
    return null;
  }

  try {
    const values = JSON.parse(valuesJson) as string[];

    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }

    return { actionId, type, values };
  } catch {
    return null;
  }
}

export function clearPendingDisabledEntries(chatId: number) {
  const current = getSession(chatId);

  if (!current?.data) {
    return;
  }

  const rest = { ...current.data };
  delete rest[SESSION_DATA_KEY.PENDING_DISABLED_TYPE];
  delete rest[SESSION_DATA_KEY.PENDING_DISABLED_VALUES];
  delete rest[SESSION_DATA_KEY.PENDING_DISABLED_ACTION_ID];

  setSession(chatId, SESSION_STEP.AWAITING_ENTRY, rest);
}

export function clearPendingEntries(chatId: number) {
  const current = getSession(chatId);

  setSession(chatId, SESSION_STEP.AWAITING_ENTRY, {
    [SESSION_DATA_KEY.LAST_CHECK_TEXT]:
      current?.data?.[SESSION_DATA_KEY.LAST_CHECK_TEXT] ?? "",
    [SESSION_DATA_KEY.CHECK_PASSED]:
      current?.data?.[SESSION_DATA_KEY.CHECK_PASSED] ?? "true",
    [SESSION_DATA_KEY.KEYBOARD_ACTIVE]:
      current?.data?.[SESSION_DATA_KEY.KEYBOARD_ACTIVE] ?? "",
  });
}

export function tryConsumeAction(actionId: string): boolean {
  if (consumedActionIds.has(actionId)) {
    return false;
  }

  consumedActionIds.add(actionId);
  return true;
}

export function buildEntryActionCallbackData(
  action: EntryAction,
  actionId: string,
): string {
  return `entry:${action}:${actionId}`;
}

export function parseEntryActionCallbackData(
  data: string,
): { action: EntryAction; actionId: string } | null {
  const match = data.match(/^entry:(add|disable|delete):([a-f0-9]{8})$/);

  if (!match) {
    return null;
  }

  return {
    action: match[1] as EntryAction,
    actionId: match[2],
  };
}

export function buildDisabledEntryActionCallbackData(
  action: DisabledEntryAction,
  actionId: string,
): string {
  return `disabled:${action}:${actionId}`;
}

export function parseDisabledEntryActionCallbackData(
  data: string,
): { action: DisabledEntryAction; actionId: string } | null {
  const match = data.match(/^disabled:(enable|delete):([a-f0-9]{8})$/);

  if (!match) {
    return null;
  }

  return {
    action: match[1] as DisabledEntryAction,
    actionId: match[2],
  };
}
