import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";
import { startMessage } from "./messages/startMessage";
import { getSession } from "./state/sessions";
import { sessiontStepHandler } from "./handlers/message";

const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error(
    "BOT_TOKEN is not set. Copy .env.example to .env and add your token.",
  );
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  void startMessage(bot, msg.chat.id);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text || text.startsWith("/")) return;

  const session = getSession(chatId);
  if (!session) return;

  sessiontStepHandler(bot, chatId, session, text);
});

console.log("Bot is running...");
