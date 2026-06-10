import TelegramBot from "node-telegram-bot-api";
import { DUPLICATE_RESOLUTION } from "../const/sessions";
import type { DuplicateResolutionStrategy } from "../const/types";
import type { EntryType } from "../utils/types";
import { TEXTS } from "./texts";

export function buildDuplicateResolutionCallbackData(
  strategy: DuplicateResolutionStrategy,
  type: EntryType,
): string {
  return `duplicates:${strategy}:${type}`;
}

export function parseDuplicateResolutionCallbackData(
  data: string,
): { strategy: DuplicateResolutionStrategy; type: EntryType } | null {
  const match = data.match(
    /^duplicates:(keep_first|keep_last|keep_active):(domain|ip)$/,
  );

  if (!match) {
    return null;
  }

  return {
    strategy: match[1] as DuplicateResolutionStrategy,
    type: match[2] as EntryType,
  };
}

export function buildDuplicateResolutionKeyboard(
  type: EntryType,
): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: TEXTS.duplicates.actions.keepFirst,
          callback_data: buildDuplicateResolutionCallbackData(
            DUPLICATE_RESOLUTION.KEEP_FIRST,
            type,
          ),
        },
      ],
      [
        {
          text: TEXTS.duplicates.actions.keepLast,
          callback_data: buildDuplicateResolutionCallbackData(
            DUPLICATE_RESOLUTION.KEEP_LAST,
            type,
          ),
        },
      ],
      [
        {
          text: TEXTS.duplicates.actions.keepActive,
          callback_data: buildDuplicateResolutionCallbackData(
            DUPLICATE_RESOLUTION.KEEP_ACTIVE,
            type,
          ),
        },
      ],
    ],
  };
}
