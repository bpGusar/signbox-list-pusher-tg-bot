import TelegramBot from "node-telegram-bot-api";
import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import { SESSION_STEP } from "../const/sessions";
import {
  checkListFilesExistence,
  checkRepositoryAccess,
} from "../github/access";
import { clearSession, setSession } from "../state/sessions";
import {
  getErrorReason,
  isFileTooLargeError,
} from "../utils/errorReason";
import {
  CheckProgressReporter,
  getDefaultBranch,
} from "./checkProgress";
import { TEXTS } from "./texts";

export const startMessage = async (bot: TelegramBot, chatId: number) => {
  clearSession(chatId);

  const progressMessage = await bot.sendMessage(
    chatId,
    TEXTS.checkProgress.title,
    { parse_mode: "Markdown" },
  );

  const progress = new CheckProgressReporter(
    bot,
    chatId,
    progressMessage.message_id,
    getDefaultBranch(),
  );

  const onProgress = progress.createCallback();
  await progress.render();

  try {
    const accessResult = await checkRepositoryAccess(onProgress);

    if (accessResult.status !== "ok") {
      clearSession(chatId);
      progress.stopSpinner();
      await progress.finish(
        TEXTS.checkProgress.withError(
          progress.getProgressText(TEXTS.checkProgress.failedHeader),
          TEXTS.access.error(accessResult),
        ),
      );
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

      clearSession(chatId);
      progress.stopSpinner();
      await progress.finish(
        TEXTS.checkProgress.withError(
          progress.getProgressText(TEXTS.checkProgress.failedHeader),
          TEXTS.files.missingLists(missingFiles),
        ),
      );
      return;
    }

    const lines = [
      TEXTS.access.ok(accessResult.repo, accessResult.branch),
      "",
      TEXTS.files.found(DOMAIN_LIST_FILE),
      TEXTS.files.found(IP_LIST_FILE),
      "",
      TEXTS.start.prompt,
    ];

    setSession(chatId, SESSION_STEP.AWAITING_ENTRY);
    await progress.finish(lines.join("\n"));
  } catch (error) {
    clearSession(chatId);
    const reason = isFileTooLargeError(error)
      ? TEXTS.files.tooLarge(error.path, error.sizeBytes)
      : getErrorReason(error);
    console.error("Start check failed:", error);

    progress.stopSpinner();
    await progress.finish(
      TEXTS.checkProgress.withError(
        progress.getProgressText(TEXTS.checkProgress.failedHeader),
        isFileTooLargeError(error)
          ? reason
          : TEXTS.start.checkFailedReason(reason),
      ),
    );
  }
};
