import TelegramBot from "node-telegram-bot-api";
import { addToList } from "../../github/lists";
import { TEXTS } from "../../messages/texts";
import { parseEntry } from "../../utils/validation";

export const awaitingEnterDomainHandler = async (
  bot: TelegramBot,
  chatId: number,
  text: string,
) => {
  const entry = parseEntry(text);

  if (!entry) {
    await bot.sendMessage(chatId, TEXTS.entry.invalidFormat, {
      parse_mode: "Markdown",
    });
    return;
  }

  const typeLabel = TEXTS.entry.typeLabel(entry.type);

  try {
    await bot.sendMessage(chatId, TEXTS.entry.checking(typeLabel, entry.value), {
      parse_mode: "Markdown",
    });

    const result = await addToList(entry.type, entry.value);

    switch (result.status) {
      case "file_not_found": {
        await bot.sendMessage(
          chatId,
          TEXTS.files.notFoundOnAdd(result.fileName),
        );
        return;
      }

      case "already_exists": {
        const message =
          result.type === "domain"
            ? TEXTS.entry.domainExists
            : TEXTS.entry.ipExists;

        await bot.sendMessage(chatId, message);
        return;
      }

      case "added": {
        await bot.sendMessage(
          chatId,
          TEXTS.entry.added(result.fileName, result.changes),
        );
        return;
      }
    }
  } catch {
    await bot.sendMessage(
      chatId,
      TEXTS.entry.addFailed(typeLabel, entry.value),
      { parse_mode: "Markdown" },
    );
  }
};
