import TelegramBot from "node-telegram-bot-api";
import { CALLBACK_DATA } from "../const/sessions";
import { TEXTS } from "./texts";

export function buildRetryCheckInlineKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: TEXTS.keyboard.retryCheck, callback_data: CALLBACK_DATA.RETRY_CHECK }],
    ],
  };
}

export const EMPTY_INLINE_KEYBOARD: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [],
};
