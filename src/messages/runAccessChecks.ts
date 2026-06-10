import TelegramBot from "node-telegram-bot-api";
import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import { SESSION_DATA_KEY, SESSION_STEP } from "../const/sessions";
import {
  checkListFilesExistence,
  checkRepositoryAccess,
} from "../github/access";
import { getSession, setSession } from "../state/sessions";
import {
  getErrorReason,
  isFileTooLargeError,
} from "../utils/errorReason";
import {
  buildRetryCheckInlineKeyboard,
  EMPTY_INLINE_KEYBOARD,
} from "./checkKeyboard";
import {
  CheckProgressReporter,
  getDefaultBranch,
} from "./checkProgress";
import {
  buildMainReplyKeyboard,
  ensureMainReplyKeyboard,
  markMainReplyKeyboardActive,
} from "./mainKeyboard";
import { promptForDuplicatesIfNeeded } from "../handlers/callback/duplicateActionHandler";
import { TEXTS } from "./texts";

type RunAccessChecksOptions = {
  preserveSession?: boolean;
};

function getSessionDataForUpdate(
  chatId: number,
  preserveSession: boolean,
): Record<string, string> | undefined {
  if (!preserveSession) {
    return undefined;
  }

  const session = getSession(chatId);
  return session?.data;
}

function setCheckSession(
  chatId: number,
  step: string,
  lastCheckText: string,
  checkPassed: boolean,
  existingData?: Record<string, string>,
) {
  setSession(chatId, step, {
    ...existingData,
    [SESSION_DATA_KEY.LAST_CHECK_TEXT]: lastCheckText,
    [SESSION_DATA_KEY.CHECK_PASSED]: checkPassed ? "true" : "false",
  });
}

export async function runAccessChecks(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  options: RunAccessChecksOptions = {},
): Promise<void> {
  const existingData = getSessionDataForUpdate(
    chatId,
    options.preserveSession ?? false,
  );

  const progress = new CheckProgressReporter(
    bot,
    chatId,
    messageId,
    getDefaultBranch(),
  );

  const onProgress = progress.createCallback();
  await progress.render();

  try {
    const accessResult = await checkRepositoryAccess(onProgress);

    if (accessResult.status !== "ok") {
      const finalText = TEXTS.checkProgress.withError(
        progress.getProgressText(TEXTS.checkProgress.failedHeader),
        TEXTS.access.error(accessResult),
      );

      setCheckSession(
        chatId,
        SESSION_STEP.CHECK_FAILED,
        finalText,
        false,
        existingData,
      );

      progress.stopSpinner();
      await progress.finish(finalText, buildRetryCheckInlineKeyboard());
      await ensureMainReplyKeyboard(bot, chatId);
      return;
    }

    const filesResult = await checkListFilesExistence(onProgress);

    if (!filesResult.allExist) {
      const missingFiles: string[] = [];

      if (!filesResult.domainListExists) {
        missingFiles.push(DOMAIN_LIST_FILE);
      }

      if (!filesResult.ipListExists) {
        missingFiles.push(IP_LIST_FILE);
      }

      const finalText = TEXTS.checkProgress.withError(
        progress.getProgressText(TEXTS.checkProgress.failedHeader),
        TEXTS.files.missingLists(missingFiles),
      );

      setCheckSession(
        chatId,
        SESSION_STEP.CHECK_FAILED,
        finalText,
        false,
        existingData,
      );

      progress.stopSpinner();
      await progress.finish(finalText, buildRetryCheckInlineKeyboard());
      await ensureMainReplyKeyboard(bot, chatId);
      return;
    }

    const finalText = [
      TEXTS.access.ok(accessResult.repo, accessResult.branch),
      "",
      TEXTS.files.found(DOMAIN_LIST_FILE),
      TEXTS.files.found(IP_LIST_FILE),
    ].join("\n");

    if (
      await promptForDuplicatesIfNeeded(bot, chatId, finalText, existingData)
    ) {
      progress.stopSpinner();

      if (options.preserveSession) {
        await progress.finish(finalText, EMPTY_INLINE_KEYBOARD);
      } else {
        await bot.sendMessage(chatId, finalText, { parse_mode: "Markdown" });

        try {
          await bot.deleteMessage(chatId, messageId);
        } catch {
          // Progress message may already be gone or too old to delete.
        }
      }

      return;
    }

    const successText = [...finalText.split("\n"), "", TEXTS.start.prompt].join(
      "\n",
    );

    setCheckSession(
      chatId,
      SESSION_STEP.AWAITING_ENTRY,
      successText,
      true,
      existingData,
    );

    progress.stopSpinner();

    if (options.preserveSession) {
      await progress.finish(successText, EMPTY_INLINE_KEYBOARD);
      await ensureMainReplyKeyboard(bot, chatId);
      return;
    }

    await bot.sendMessage(chatId, successText, {
      parse_mode: "Markdown",
      reply_markup: buildMainReplyKeyboard(),
    });

    try {
      await bot.deleteMessage(chatId, messageId);
    } catch {
      // Progress message may already be gone or too old to delete.
    }

    markMainReplyKeyboardActive(chatId);
  } catch (error) {
    const reason = isFileTooLargeError(error)
      ? TEXTS.files.tooLarge(error.path, error.sizeBytes)
      : getErrorReason(error);
    console.error("Start check failed:", error);

    const finalText = TEXTS.checkProgress.withError(
      progress.getProgressText(TEXTS.checkProgress.failedHeader),
      isFileTooLargeError(error)
        ? reason
        : TEXTS.start.checkFailedReason(reason),
    );

    setCheckSession(
      chatId,
      SESSION_STEP.CHECK_FAILED,
      finalText,
      false,
      existingData,
    );

    progress.stopSpinner();
    await progress.finish(finalText, buildRetryCheckInlineKeyboard());
    await ensureMainReplyKeyboard(bot, chatId);
  }
}
