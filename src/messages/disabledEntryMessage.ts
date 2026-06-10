import TelegramBot from "node-telegram-bot-api";
import { buildDisabledEntryActionKeyboard } from "./disabledEntryKeyboard";
import { TEXTS } from "./texts";

export async function sendDisabledEntriesPrompt(
  bot: TelegramBot,
  chatId: number,
  fileName: string,
  values: string[],
  actionId: string,
  onlyDisabled = false,
): Promise<void> {
  const text = onlyDisabled
    ? TEXTS.disabledEntries.onlyDisabled(fileName, values)
    : TEXTS.disabledEntries.prompt(fileName, values);

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: buildDisabledEntryActionKeyboard(actionId),
  });
}
