import TelegramBot from "node-telegram-bot-api";
import { runAccessChecks } from "../../messages/runAccessChecks";

const retryInProgress = new Set<number>();

export async function retryCheckHandler(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
) {
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;

  if (!chatId || !messageId) {
    return;
  }

  await bot.answerCallbackQuery(query.id);

  if (retryInProgress.has(chatId)) {
    return;
  }

  retryInProgress.add(chatId);

  try {
    await runAccessChecks(bot, chatId, messageId, { preserveSession: true });
  } finally {
    retryInProgress.delete(chatId);
  }
}
