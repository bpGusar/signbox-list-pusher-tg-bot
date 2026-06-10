import TelegramBot from "node-telegram-bot-api";
import { clearSession } from "../state/sessions";
import { runAccessChecks } from "./runAccessChecks";
import { TEXTS } from "./texts";

export const startMessage = async (bot: TelegramBot, chatId: number) => {
  clearSession(chatId);

  const progressMessage = await bot.sendMessage(
    chatId,
    TEXTS.checkProgress.title,
    { parse_mode: "Markdown" },
  );

  await runAccessChecks(bot, chatId, progressMessage.message_id);
};
