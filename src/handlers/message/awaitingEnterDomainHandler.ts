import TelegramBot from "node-telegram-bot-api";
import { buildEntryActionKeyboard } from "../../messages/entryKeyboard";
import { removeInlineKeyboard } from "../../messages/entryConfirmMessage";
import { TEXTS } from "../../messages/texts";
import {
  getPendingMessageId,
  getSession,
  setPendingEntries,
  setPendingMessageId,
} from "../../state/sessions";
import { parseEntries } from "../../utils/validation";

export const awaitingEnterDomainHandler = async (
  bot: TelegramBot,
  chatId: number,
  text: string,
) => {
  const parsed = parseEntries(text);

  if (!parsed.ok) {
    const message =
      parsed.reason === "mixed_types"
        ? TEXTS.entry.mixedTypes
        : parsed.reason === "invalid" && parsed.invalid.length > 0
          ? TEXTS.entry.invalidItems(parsed.invalid)
          : TEXTS.entry.invalidFormat;

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    return;
  }

  const previousMessageId = getPendingMessageId(getSession(chatId));

  const { type, values } = parsed;
  const actionId = setPendingEntries(chatId, type, values);

  if (previousMessageId) {
    await removeInlineKeyboard(bot, chatId, previousMessageId);
  }

  const sent = await bot.sendMessage(
    chatId,
    TEXTS.entry.confirmPrompt(type, values),
    {
      parse_mode: "Markdown",
      reply_markup: buildEntryActionKeyboard(actionId),
    },
  );

  setPendingMessageId(chatId, sent.message_id);
};
