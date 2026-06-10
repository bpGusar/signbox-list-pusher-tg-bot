import TelegramBot from "node-telegram-bot-api";
import { SESSION_STEP } from "../../const/sessions";
import { TEXTS } from "../../messages/texts";
import { awaitingEnterDomainHandler } from "./awaitingEnterDomainHandler";
import { Session } from "../../state/types";

export const sessiontStepHandler = (
  bot: TelegramBot,
  chatId: number,
  session: Session,
  text: string,
) => {
  switch (session.step) {
    case SESSION_STEP.AWAITING_ENTRY:
      void awaitingEnterDomainHandler(bot, chatId, text);
      break;
    case SESSION_STEP.AWAITING_DUPLICATE_RESOLUTION:
      void bot.sendMessage(chatId, TEXTS.duplicates.blockedEntry);
      break;
    case SESSION_STEP.AWAITING_DISABLED_RESOLUTION:
      void bot.sendMessage(chatId, TEXTS.disabledEntries.blockedEntry);
      break;
    default:
      break;
  }
};
