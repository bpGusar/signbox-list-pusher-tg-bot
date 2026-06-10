import TelegramBot from "node-telegram-bot-api";
import { ENTRY_ACTION } from "../../const/sessions";
import type { EntryAction } from "../../const/types";
import {
  addManyToList,
  disableManyInList,
  removeManyFromList,
  type DuplicatesInFileResult,
} from "../../github/lists";
import { findListDuplicates } from "../../github/listDuplicates";
import { promptDuplicatesForType } from "./duplicateActionHandler";
import {
  markConfirmMessageInProgress,
  removeInlineKeyboard,
} from "../../messages/entryConfirmMessage";
import { sendDisabledEntriesPrompt } from "../../messages/disabledEntryMessage";
import { sendDuplicatesPrompt } from "../../messages/duplicateMessage";
import { TEXTS } from "../../messages/texts";
import {
  clearPendingEntries,
  clearSession,
  getPendingEntries,
  getSession,
  parseEntryActionCallbackData,
  setPendingDisabledEntries,
  tryConsumeAction,
} from "../../state/sessions";
import {
  getErrorReason,
  getFileTooLargeDetails,
  isGithubAuthError,
} from "../../utils/errorReason";
import type { EntryType } from "../../utils/types";

function getActionLabel(action: EntryAction): string {
  return TEXTS.entry.actionLabels[action];
}

async function handleDuplicatesInFile(
  bot: TelegramBot,
  chatId: number,
  result: DuplicatesInFileResult,
) {
  await promptDuplicatesForType(bot, chatId, result.type);
}

async function promptDisabledEntriesIfNeeded(
  bot: TelegramBot,
  chatId: number,
  type: EntryType,
  fileName: string,
  disabledInFile: string[],
  skipped: string[],
) {
  if (disabledInFile.length === 0) {
    return;
  }

  const actionId = setPendingDisabledEntries(chatId, type, disabledInFile);

  await sendDisabledEntriesPrompt(
    bot,
    chatId,
    fileName,
    disabledInFile,
    actionId,
    skipped.length === 0,
  );
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
      await bot.sendMessage(chatId, TEXTS.files.notFoundOnAdd(result.fileName));
      return;
    }

    case "duplicates_in_file": {
      await handleDuplicatesInFile(bot, chatId, result);
      return;
    }

    case "all_exist": {
      if (result.skipped.length > 0) {
        await bot.sendMessage(
          chatId,
          TEXTS.entry.allExist(result.type, result.skipped),
          { parse_mode: "Markdown" },
        );
      }

      await promptDisabledEntriesIfNeeded(
        bot,
        chatId,
        result.type,
        result.fileName,
        result.disabledInFile,
        result.skipped,
      );
      return;
    }

    case "added": {
      await bot.sendMessage(
        chatId,
        TEXTS.entry.added(result.fileName, result.changes, result.skipped),
      );

      await promptDisabledEntriesIfNeeded(
        bot,
        chatId,
        result.type,
        result.fileName,
        result.disabledInFile,
        result.skipped,
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
      await bot.sendMessage(chatId, TEXTS.files.notFoundOnAdd(result.fileName));
      return;
    }

    case "duplicates_in_file": {
      await handleDuplicatesInFile(bot, chatId, result);
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
      await bot.sendMessage(chatId, TEXTS.files.notFoundOnAdd(result.fileName));
      return;
    }

    case "duplicates_in_file": {
      await handleDuplicatesInFile(bot, chatId, result);
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

  const { type, values } = pending;

  if (action === ENTRY_ACTION.CANCEL) {
    clearPendingEntries(chatId);

    if (messageId) {
      await removeInlineKeyboard(bot, chatId, messageId);
    }

    await bot.answerCallbackQuery(callbackQueryId);
    await bot.sendMessage(chatId, TEXTS.entry.actionCancelled);
    return;
  }

  const duplicateReport = await findListDuplicates(type);

  if (duplicateReport) {
    await bot.answerCallbackQuery(callbackQueryId, {
      text: TEXTS.duplicates.blockedAction,
      show_alert: true,
    });
    await sendDuplicatesPrompt(bot, chatId, duplicateReport);
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
    const fileTooLarge = getFileTooLargeDetails(error);
    const reason = fileTooLarge
      ? TEXTS.files.tooLarge(fileTooLarge.path, fileTooLarge.sizeBytes)
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
