import TelegramBot from "node-telegram-bot-api";
import { SESSION_DATA_KEY } from "../../const/sessions";
import { buildRetryCheckInlineKeyboard } from "../../messages/checkKeyboard";
import {
  buildMainReplyKeyboard,
  ensureMainReplyKeyboard,
  markMainReplyKeyboardActive,
} from "../../messages/mainKeyboard";
import { TEXTS } from "../../messages/texts";
import { getSession } from "../../state/sessions";

export async function showStatusHandler(bot: TelegramBot, chatId: number) {
  const session = getSession(chatId);
  const lastCheckText = session?.data?.[SESSION_DATA_KEY.LAST_CHECK_TEXT];

  if (!lastCheckText) {
    await bot.sendMessage(chatId, TEXTS.keyboard.noCheckYet);
    return;
  }

  const checkPassed =
    session?.data?.[SESSION_DATA_KEY.CHECK_PASSED] === "true";

  if (checkPassed) {
    await bot.sendMessage(chatId, lastCheckText, {
      parse_mode: "Markdown",
      reply_markup: buildMainReplyKeyboard(),
    });
    markMainReplyKeyboardActive(chatId);
    return;
  }

  await bot.sendMessage(chatId, lastCheckText, {
    parse_mode: "Markdown",
    reply_markup: buildRetryCheckInlineKeyboard(),
  });

  await ensureMainReplyKeyboard(bot, chatId);
}
