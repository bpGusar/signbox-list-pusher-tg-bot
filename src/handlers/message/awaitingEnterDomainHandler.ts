import TelegramBot from "node-telegram-bot-api";
import { addManyToList } from "../../github/lists";
import { TEXTS } from "../../messages/texts";
import { clearSession } from "../../state/sessions";
import {
  getErrorReason,
  isFileTooLargeError,
  isGithubAuthError,
} from "../../utils/errorReason";
import { parseEntries } from "../../utils/validation";

export const awaitingEnterDomainHandler = async (
  bot: TelegramBot,
  chatId: number,
  text: string,
) => {
  const parsed = parseEntries(text);

  if (!parsed.ok) {
    const message =
      parsed.reason === "mixed_types"
        ? TEXTS.entry.mixedTypes
        : parsed.reason === "invalid" && parsed.invalid.length > 0
          ? TEXTS.entry.invalidItems(parsed.invalid)
          : TEXTS.entry.invalidFormat;

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    return;
  }

  const { type, values } = parsed;

  try {
    await bot.sendMessage(chatId, TEXTS.entry.checking(values), {
      parse_mode: "Markdown",
    });

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
  } catch (error) {
    const reason = isFileTooLargeError(error)
      ? TEXTS.files.tooLarge(error.path, error.sizeBytes)
      : getErrorReason(error);
    const sessionReset = isGithubAuthError(error);

    if (sessionReset) {
      clearSession(chatId);
    }

    console.error("Add entry failed:", error);

    await bot.sendMessage(
      chatId,
      TEXTS.entry.addFailed(values, reason, sessionReset),
      { parse_mode: "Markdown" },
    );
  }
};
