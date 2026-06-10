import TelegramBot from "node-telegram-bot-api";
import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import type {
  CheckProgressCallback,
  CheckStepId,
  Step,
  StepStatus,
} from "./types";
import { TEXTS } from "./texts";

export type { CheckProgressCallback, CheckStepId } from "./types";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class CheckProgressReporter {
  private readonly steps: Step[];
  private spinnerIndex = 0;
  private spinnerTimer: ReturnType<typeof setInterval> | undefined;
  private renderQueued = false;

  constructor(
    private readonly bot: TelegramBot,
    private readonly chatId: number,
    private readonly messageId: number,
    branch: string,
  ) {
    this.steps = [
      { id: "env", label: TEXTS.checkProgress.steps.env, status: "pending" },
      { id: "repo", label: TEXTS.checkProgress.steps.repo, status: "pending" },
      {
        id: "permissions",
        label: TEXTS.checkProgress.steps.permissions,
        status: "pending",
      },
      {
        id: "branch",
        label: TEXTS.checkProgress.steps.branch(branch),
        status: "pending",
      },
      {
        id: "domain_file",
        label: TEXTS.checkProgress.steps.domainFile,
        status: "pending",
      },
      {
        id: "ip_file",
        label: TEXTS.checkProgress.steps.ipFile,
        status: "pending",
      },
    ];
  }

  createCallback(): CheckProgressCallback {
    return (step, status) => {
      if (status === "start") {
        this.setRunning(step);
        return;
      }

      if (status === "done") {
        this.setDone(step);
        return;
      }

      this.setFailed(step);
    };
  }

  getProgressText(header: string = TEXTS.checkProgress.title): string {
    return [
      header,
      "",
      ...this.steps.map((step) => this.formatStep(step)),
    ].join("\n");
  }

  async render(header: string = TEXTS.checkProgress.title): Promise<void> {
    try {
      await this.bot.editMessageText(this.getProgressText(header), {
        chat_id: this.chatId,
        message_id: this.messageId,
        parse_mode: "Markdown",
      });
    } catch {
      // Сообщение не изменилось или сработал rate limit — игнорируем
    }
  }

  async finish(
    text: string,
    replyMarkup?: TelegramBot.InlineKeyboardMarkup,
  ): Promise<void> {
    this.stopSpinner();

    await this.bot.editMessageText(text, {
      chat_id: this.chatId,
      message_id: this.messageId,
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    });
  }

  stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = undefined;
    }
  }

  private formatStep(step: Step): string {
    const icon = this.getStepIcon(step.status);
    const suffix = step.status === "running" ? "..." : "";

    return `${icon} ${step.label}${suffix}`;
  }

  private getStepIcon(status: StepStatus): string {
    if (status === "running") {
      return SPINNER_FRAMES[this.spinnerIndex] ?? "⏳";
    }

    if (status === "done") return "✅";
    if (status === "failed") return "❌";

    return "⬜";
  }

  private setRunning(stepId: CheckStepId): void {
    for (const step of this.steps) {
      if (step.id === stepId) {
        step.status = "running";
      } else if (step.status === "running") {
        step.status = "done";
      }
    }

    this.startSpinner();
    void this.queueRender();
  }

  private setDone(stepId: CheckStepId): void {
    const step = this.steps.find((item) => item.id === stepId);
    if (step) {
      step.status = "done";
    }

    if (!this.steps.some((item) => item.status === "running")) {
      this.stopSpinner();
    }

    void this.queueRender();
  }

  private setFailed(stepId: CheckStepId): void {
    const step = this.steps.find((item) => item.id === stepId);
    if (step) {
      step.status = "failed";
    }

    this.stopSpinner();
    void this.queueRender();
  }

  private startSpinner(): void {
    this.stopSpinner();

    this.spinnerTimer = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER_FRAMES.length;
      void this.queueRender();
    }, 400);
  }

  private async queueRender(): Promise<void> {
    if (this.renderQueued) return;

    this.renderQueued = true;
    await this.render();
    this.renderQueued = false;
  }
}

export function getDefaultBranch(): string {
  return process.env.GITHUB_BRANCH ?? "main";
}

export { DOMAIN_LIST_FILE, IP_LIST_FILE };
