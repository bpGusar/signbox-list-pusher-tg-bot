export type SessionStep = string;

export type Session = {
  step: SessionStep;
  data?: Record<string, string>;
};

const sessions = new Map<number, Session>();

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
