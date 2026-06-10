import TelegramBot from "node-telegram-bot-api";
import type { ListDuplicatesReport } from "../github/listDuplicates";
import { buildDuplicateResolutionKeyboard } from "./duplicateKeyboard";
import { TEXTS } from "./texts";

export function formatDuplicatesText(report: ListDuplicatesReport): string {
  return TEXTS.duplicates.prompt(report);
}

export async function sendDuplicatesPrompt(
  bot: TelegramBot,
  chatId: number,
  report: ListDuplicatesReport,
): Promise<void> {
  await bot.sendMessage(chatId, formatDuplicatesText(report), {
    parse_mode: "Markdown",
    reply_markup: buildDuplicateResolutionKeyboard(report.type),
  });
}
