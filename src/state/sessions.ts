import { randomBytes } from "node:crypto";
import {
  SESSION_DATA_KEY,
  SESSION_STEP,
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

export function clearPendingEntries(chatId: number) {
  setSession(chatId, SESSION_STEP.AWAITING_ENTRY);
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
