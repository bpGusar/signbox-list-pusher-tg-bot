import TelegramBot from "node-telegram-bot-api";
import { CALLBACK_DATA } from "../../const/sessions";
import { disabledEntryActionHandler } from "./disabledEntryActionHandler";
import { duplicateActionHandler } from "./duplicateActionHandler";
import { entryActionHandler } from "./entryActionHandler";
import { retryCheckHandler } from "./retryCheckHandler";

export const callbackQueryHandler = (
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
) => {
  const chatId = query.message?.chat.id;
  const data = query.data;

  if (!chatId || !data) {
    return;
  }

  if (data.startsWith("duplicates:")) {
    void duplicateActionHandler(bot, query);
    return;
  }

  if (data === CALLBACK_DATA.RETRY_CHECK) {
    void retryCheckHandler(bot, query);
    return;
  }

  if (data.startsWith("disabled:")) {
    void disabledEntryActionHandler(
      bot,
      chatId,
      data,
      query.id,
      query.message?.message_id,
    );
    return;
  }

  if (data.startsWith("entry:")) {
    void entryActionHandler(
      bot,
      chatId,
      data,
      query.id,
      query.message?.message_id,
      query.message?.text,
    );
  }
};
