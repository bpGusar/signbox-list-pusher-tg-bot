import TelegramBot from "node-telegram-bot-api";
import { ENTRY_ACTION, type EntryAction } from "../../const/sessions";
import {
  addManyToList,
  disableManyInList,
  removeManyFromList,
} from "../../github/lists";
import {
  markConfirmMessageInProgress,
  removeInlineKeyboard,
} from "../../messages/entryConfirmMessage";
import { TEXTS } from "../../messages/texts";
import {
  clearPendingEntries,
  clearSession,
  getPendingEntries,
  getSession,
  parseEntryActionCallbackData,
  tryConsumeAction,
} from "../../state/sessions";
import {
  getErrorReason,
  isFileTooLargeError,
  isGithubAuthError,
} from "../../utils/errorReason";
import type { EntryType } from "../../utils/validation";

function getActionLabel(action: EntryAction): string {
  return TEXTS.entry.actionLabels[action];
}

async function handleAdd(
  bot: TelegramBot,
  chatId: number,
  type: EntryType,
  values: string[],
) {
  const result = await addManyToList(type, values);

  switch (result.status) {
    case "file_not_found": {
      await bot.sendMessage(
        chatId,
        TEXTS.files.notFoundOnAdd(result.fileName),
      );
      return;
    }

    case "all_exist": {
      await bot.sendMessage(
        chatId,
        TEXTS.entry.allExist(result.type, result.skipped),
        { parse_mode: "Markdown" },
      );
      return;
    }

    case "added": {
      await bot.sendMessage(
        chatId,
        TEXTS.entry.added(result.fileName, result.changes, result.skipped),
      );
      return;
    }
  }
}

async function handleDisable(
  bot: TelegramBot,
  chatId: number,
  type: EntryType,
  values: string[],
) {
  const result = await disableManyInList(type, values);

  switch (result.status) {
    case "file_not_found": {
      await bot.sendMessage(
        chatId,
        TEXTS.files.notFoundOnAdd(result.fileName),
      );
      return;
    }

    case "no_changes": {
      await bot.sendMessage(
        chatId,
        TEXTS.entry.disabledNone(result.type, result.skipped, result.notFound),
      );
      return;
    }

    case "modified": {
      await bot.sendMessage(
        chatId,
        TEXTS.entry.disabled(
          result.fileName,
          result.changes,
          result.skipped,
          result.notFound,
        ),
      );
      return;
    }
  }
}

async function handleDelete(
  bot: TelegramBot,
  chatId: number,
  type: EntryType,
  values: string[],
) {
  const result = await removeManyFromList(type, values);

  switch (result.status) {
    case "file_not_found": {
      await bot.sendMessage(
        chatId,
        TEXTS.files.notFoundOnAdd(result.fileName),
      );
      return;
    }

    case "no_changes": {
      await bot.sendMessage(
        chatId,
        TEXTS.entry.removedNone(result.type, result.notFound),
      );
      return;
    }

    case "modified": {
      await bot.sendMessage(
        chatId,
        TEXTS.entry.removed(result.fileName, result.changes, result.notFound),
      );
      return;
    }
  }
}

export const entryActionHandler = async (
  bot: TelegramBot,
  chatId: number,
  callbackData: string,
  callbackQueryId: string,
  messageId?: number,
  messageText?: string,
) => {
  const parsed = parseEntryActionCallbackData(callbackData);

  if (!parsed) {
    await bot.answerCallbackQuery(callbackQueryId);
    return;
  }

  const { action, actionId } = parsed;

  if (!tryConsumeAction(actionId)) {
    if (messageId) {
      await removeInlineKeyboard(bot, chatId, messageId);
    }

    await bot.answerCallbackQuery(callbackQueryId, {
      text: TEXTS.entry.actionAlreadyHandled,
    });
    return;
  }

  const session = getSession(chatId);
  const pending = session ? getPendingEntries(session) : null;

  if (!pending || pending.actionId !== actionId) {
    if (messageId) {
      await removeInlineKeyboard(bot, chatId, messageId);
    }

    await bot.answerCallbackQuery(callbackQueryId, {
      text: TEXTS.entry.actionExpired,
      show_alert: true,
    });
    return;
  }

  clearPendingEntries(chatId);

  if (messageId && messageText) {
    await markConfirmMessageInProgress(
      bot,
      chatId,
      messageId,
      messageText,
      action,
    );
  } else if (messageId) {
    await removeInlineKeyboard(bot, chatId, messageId);
  }

  await bot.answerCallbackQuery(callbackQueryId);

  const { type, values } = pending;

  try {
    await bot.sendMessage(chatId, TEXTS.entry.checking(values), {
      parse_mode: "Markdown",
    });

    switch (action) {
      case ENTRY_ACTION.ADD:
        await handleAdd(bot, chatId, type, values);
        break;
      case ENTRY_ACTION.DISABLE:
        await handleDisable(bot, chatId, type, values);
        break;
      case ENTRY_ACTION.DELETE:
        await handleDelete(bot, chatId, type, values);
        break;
    }
  } catch (error) {
    const reason = isFileTooLargeError(error)
      ? TEXTS.files.tooLarge(error.path, error.sizeBytes)
      : getErrorReason(error);
    const sessionReset = isGithubAuthError(error);

    if (sessionReset) {
      clearSession(chatId);
    }

    console.error("Entry action failed:", error);

    await bot.sendMessage(
      chatId,
      TEXTS.entry.actionFailed(
        getActionLabel(action),
        values,
        reason,
        sessionReset,
      ),
      { parse_mode: "Markdown" },
    );
  }
};
