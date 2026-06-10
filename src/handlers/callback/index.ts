import TelegramBot from "node-telegram-bot-api";
import { entryActionHandler } from "./entryActionHandler";

export const callbackQueryHandler = (
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
) => {
  const chatId = query.message?.chat.id;
  const data = query.data;

  if (!chatId || !data) {
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
