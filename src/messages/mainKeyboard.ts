import TelegramBot from "node-telegram-bot-api";
import { SESSION_DATA_KEY } from "../const/sessions";
import { getSession, setSession } from "../state/sessions";
import { TEXTS } from "./texts";

export function buildMainReplyKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: TEXTS.keyboard.showStatus }]],
    resize_keyboard: true,
  };
}

export function markMainReplyKeyboardActive(chatId: number): void {
  const session = getSession(chatId);

  if (!session) {
    return;
  }

  setSession(chatId, session.step, {
    ...session.data,
    [SESSION_DATA_KEY.KEYBOARD_ACTIVE]: "true",
  });
}

export async function ensureMainReplyKeyboard(
  bot: TelegramBot,
  chatId: number,
): Promise<void> {
  const session = getSession(chatId);

  if (session?.data?.[SESSION_DATA_KEY.KEYBOARD_ACTIVE] === "true") {
    return;
  }

  try {
    await bot.sendMessage(chatId, TEXTS.keyboard.menuActivated, {
      reply_markup: buildMainReplyKeyboard(),
      disable_notification: true,
    });
  } catch (error) {
    console.error("Failed to activate reply keyboard:", error);
    return;
  }

  markMainReplyKeyboardActive(chatId);
}
