import TelegramBot from "node-telegram-bot-api";
import { DISABLED_ENTRY_ACTION } from "../../const/sessions";
import {
  enableManyInList,
  removeManyFromList,
  type DuplicatesInFileResult,
} from "../../github/lists";
import { findListDuplicates } from "../../github/listDuplicates";
import { promptDuplicatesForType } from "./duplicateActionHandler";
import { sendDuplicatesPrompt } from "../../messages/duplicateMessage";
import { TEXTS } from "../../messages/texts";
import {
  clearPendingDisabledEntries,
  clearSession,
  getPendingDisabledEntries,
  getSession,
  parseDisabledEntryActionCallbackData,
  tryConsumeAction,
} from "../../state/sessions";
import {
  getErrorReason,
  getFileTooLargeDetails,
  isGithubAuthError,
} from "../../utils/errorReason";

async function handleDuplicatesInFile(
  bot: TelegramBot,
  chatId: number,
  result: DuplicatesInFileResult,
) {
  await promptDuplicatesForType(bot, chatId, result.type);
}

async function handleEnable(
  bot: TelegramBot,
  chatId: number,
  type: "domain" | "ip",
  values: string[],
) {
  const result = await enableManyInList(type, values);

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
        TEXTS.disabledEntries.enabledNone(
          result.type,
          result.skipped,
          result.notFound,
        ),
      );
      return;
    }

    case "modified": {
      await bot.sendMessage(
        chatId,
        TEXTS.disabledEntries.enabled(
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
  type: "domain" | "ip",
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

export const disabledEntryActionHandler = async (
  bot: TelegramBot,
  chatId: number,
  callbackData: string,
  callbackQueryId: string,
  messageId?: number,
) => {
  const parsed = parseDisabledEntryActionCallbackData(callbackData);

  if (!parsed) {
    await bot.answerCallbackQuery(callbackQueryId);
    return;
  }

  const { action, actionId } = parsed;

  if (!tryConsumeAction(actionId)) {
    if (messageId) {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: messageId },
      );
    }

    await bot.answerCallbackQuery(callbackQueryId, {
      text: TEXTS.disabledEntries.actionAlreadyHandled,
    });
    return;
  }

  const session = getSession(chatId);
  const pending = session ? getPendingDisabledEntries(session) : null;

  if (!pending || pending.actionId !== actionId) {
    if (messageId) {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: messageId },
      );
    }

    await bot.answerCallbackQuery(callbackQueryId, {
      text: TEXTS.disabledEntries.actionExpired,
      show_alert: true,
    });
    return;
  }

  const { type, values } = pending;
  const duplicateReport = await findListDuplicates(type);

  if (duplicateReport) {
    await bot.answerCallbackQuery(callbackQueryId, {
      text: TEXTS.duplicates.blockedAction,
      show_alert: true,
    });
    await sendDuplicatesPrompt(bot, chatId, duplicateReport);
    return;
  }

  clearPendingDisabledEntries(chatId);

  if (messageId) {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId },
    );
  }

  await bot.answerCallbackQuery(callbackQueryId);

  const actionLabel =
    action === DISABLED_ENTRY_ACTION.ENABLE
      ? TEXTS.disabledEntries.actions.enable
      : TEXTS.disabledEntries.actions.delete;

  try {
    await bot.sendMessage(chatId, TEXTS.entry.checking(values), {
      parse_mode: "Markdown",
    });

    switch (action) {
      case DISABLED_ENTRY_ACTION.ENABLE:
        await handleEnable(bot, chatId, type, values);
        break;
      case DISABLED_ENTRY_ACTION.DELETE:
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

    console.error("Disabled entry action failed:", error);

    await bot.sendMessage(
      chatId,
      TEXTS.entry.actionFailed(actionLabel, values, reason, sessionReset),
      { parse_mode: "Markdown" },
    );
  }
};
