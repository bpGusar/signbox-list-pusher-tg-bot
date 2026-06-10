import TelegramBot from "node-telegram-bot-api";
import type { EntryAction } from "../const/types";
import { TEXTS } from "./texts";

function getActionLabel(action: EntryAction): string {
  return TEXTS.entry.actionLabels[action];
}

export async function removeInlineKeyboard(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
) {
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId },
    );
  } catch {
    // Message may already have no keyboard or be too old to edit.
  }
}

export async function markConfirmMessageInProgress(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  messageText: string,
  action: EntryAction,
) {
  const updatedText = [
    messageText,
    "",
    TEXTS.entry.confirmActionInProgress(getActionLabel(action)),
  ].join("\n");

  try {
    await bot.editMessageText(updatedText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [] },
    });
    return;
  } catch {
    await removeInlineKeyboard(bot, chatId, messageId);
  }
}
