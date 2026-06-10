import TelegramBot from "node-telegram-bot-api";
import { DISABLED_ENTRY_ACTION } from "../const/sessions";
import { buildDisabledEntryActionCallbackData } from "../state/sessions";
import { TEXTS } from "./texts";

export function buildDisabledEntryActionKeyboard(
  actionId: string,
): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: TEXTS.disabledEntries.actions.enable,
          callback_data: buildDisabledEntryActionCallbackData(
            DISABLED_ENTRY_ACTION.ENABLE,
            actionId,
          ),
        },
        {
          text: TEXTS.disabledEntries.actions.delete,
          callback_data: buildDisabledEntryActionCallbackData(
            DISABLED_ENTRY_ACTION.DELETE,
            actionId,
          ),
        },
      ],
      [
        {
          text: TEXTS.disabledEntries.actions.keep,
          callback_data: buildDisabledEntryActionCallbackData(
            DISABLED_ENTRY_ACTION.KEEP,
            actionId,
          ),
        },
      ],
    ],
  };
}
