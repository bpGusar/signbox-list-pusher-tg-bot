import TelegramBot from "node-telegram-bot-api";
import { SESSION_STEP } from "../../const/sessions";
import { awaitingEnterDomainHandler } from "./awaitingEnterDomainHandler";
import { Session } from "../../state/sessions";

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
    default:
      break;
  }
};
