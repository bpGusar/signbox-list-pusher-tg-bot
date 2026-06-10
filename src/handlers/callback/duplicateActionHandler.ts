import TelegramBot from "node-telegram-bot-api";
import { SESSION_DATA_KEY, SESSION_STEP } from "../../const/sessions";
import {
  findAllListDuplicates,
  findListDuplicates,
  resolveListDuplicates,
} from "../../github/listDuplicates";
import { parseDuplicateResolutionCallbackData } from "../../messages/duplicateKeyboard";
import { sendDuplicatesPrompt } from "../../messages/duplicateMessage";
import { ensureMainReplyKeyboard } from "../../messages/mainKeyboard";
import { TEXTS } from "../../messages/texts";
import { getSession, setSession } from "../../state/sessions";
import {
  getErrorReason,
  isFileTooLargeError,
} from "../../utils/errorReason";

async function continueAfterDuplicateResolution(
  bot: TelegramBot,
  chatId: number,
): Promise<void> {
  const remaining = await findAllListDuplicates();

  if (remaining.length > 0) {
    setSession(chatId, SESSION_STEP.AWAITING_DUPLICATE_RESOLUTION, {
      ...getSession(chatId)?.data,
      [SESSION_DATA_KEY.CHECK_PASSED]: "false",
    });

    await sendDuplicatesPrompt(bot, chatId, remaining[0]!);
    return;
  }

  const session = getSession(chatId);
  const lastCheckText = session?.data?.[SESSION_DATA_KEY.LAST_CHECK_TEXT] ?? "";

  const baseText = lastCheckText.includes(TEXTS.start.prompt)
    ? lastCheckText.replace(`\n\n${TEXTS.start.prompt}`, "")
    : lastCheckText;

  setSession(chatId, SESSION_STEP.AWAITING_ENTRY, {
    ...session?.data,
    [SESSION_DATA_KEY.LAST_CHECK_TEXT]: [baseText, "", TEXTS.start.prompt].join(
      "\n",
    ),
    [SESSION_DATA_KEY.CHECK_PASSED]: "true",
  });

  await bot.sendMessage(
    chatId,
    [TEXTS.duplicates.allResolved, "", TEXTS.start.prompt].join("\n"),
    {
      parse_mode: "Markdown",
    },
  );

  await ensureMainReplyKeyboard(bot, chatId);
}

export async function duplicateActionHandler(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
) {
  const chatId = query.message?.chat.id;
  const data = query.data;

  if (!chatId || !data) {
    return;
  }

  const parsed = parseDuplicateResolutionCallbackData(data);

  if (!parsed) {
    return;
  }

  await bot.answerCallbackQuery(query.id);

  try {
    const result = await resolveListDuplicates(parsed.type, parsed.strategy);

    switch (result.status) {
      case "file_not_found": {
        await bot.sendMessage(chatId, TEXTS.files.notFoundOnAdd(result.fileName));
        return;
      }

      case "no_duplicates": {
        await bot.sendMessage(
          chatId,
          TEXTS.duplicates.stillHasDuplicates(result.fileName),
          { parse_mode: "Markdown" },
        );
        return;
      }

      case "resolved": {
        await bot.sendMessage(
          chatId,
          TEXTS.duplicates.resolved(result.fileName, result.removedCount),
          { parse_mode: "Markdown" },
        );
        await continueAfterDuplicateResolution(bot, chatId);
        return;
      }
    }
  } catch (error) {
    const reason = isFileTooLargeError(error)
      ? TEXTS.files.tooLarge(error.path, error.sizeBytes)
      : getErrorReason(error);

    console.error("Duplicate resolution failed:", error);

    await bot.sendMessage(chatId, TEXTS.start.checkFailedReason(reason), {
      parse_mode: "Markdown",
    });
  }
}

export async function promptForDuplicatesIfNeeded(
  bot: TelegramBot,
  chatId: number,
  baseCheckText: string,
  existingData?: Record<string, string>,
): Promise<boolean> {
  const reports = await findAllListDuplicates();

  if (reports.length === 0) {
    return false;
  }

  setSession(chatId, SESSION_STEP.AWAITING_DUPLICATE_RESOLUTION, {
    ...existingData,
    [SESSION_DATA_KEY.LAST_CHECK_TEXT]: baseCheckText,
    [SESSION_DATA_KEY.CHECK_PASSED]: "false",
  });

  await sendDuplicatesPrompt(bot, chatId, reports[0]!);
  await ensureMainReplyKeyboard(bot, chatId);
  return true;
}

export async function promptDuplicatesForType(
  bot: TelegramBot,
  chatId: number,
  type: "domain" | "ip",
): Promise<boolean> {
  const report = await findListDuplicates(type);

  if (!report) {
    return false;
  }

  setSession(chatId, SESSION_STEP.AWAITING_DUPLICATE_RESOLUTION, {
    ...getSession(chatId)?.data,
    [SESSION_DATA_KEY.CHECK_PASSED]: "false",
  });

  await sendDuplicatesPrompt(bot, chatId, report);
  return true;
}
