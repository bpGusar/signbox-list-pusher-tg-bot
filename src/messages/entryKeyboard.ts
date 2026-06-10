import { ENTRY_ACTION } from "../const/sessions";
import { buildEntryActionCallbackData } from "../state/sessions";
import { TEXTS } from "./texts";

export function buildEntryActionKeyboard(actionId: string) {
  return {
    inline_keyboard: [
      [
        {
          text: TEXTS.entry.actionLabels.disable,
          callback_data: buildEntryActionCallbackData(
            ENTRY_ACTION.DISABLE,
            actionId,
          ),
        },
        {
          text: TEXTS.entry.actionLabels.delete,
          callback_data: buildEntryActionCallbackData(
            ENTRY_ACTION.DELETE,
            actionId,
          ),
        },
        {
          text: TEXTS.entry.actionLabels.add,
          callback_data: buildEntryActionCallbackData(
            ENTRY_ACTION.ADD,
            actionId,
          ),
        },
      ],
    ],
  };
}
