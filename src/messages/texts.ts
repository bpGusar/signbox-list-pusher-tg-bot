import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import type { AccessCheckResult } from "../github/access";
import type { EntryType } from "../utils/validation";

export const TEXTS = {
  start: {
    prompt:
      "Отправьте домен в формате `example.com` или IP/CIDR.\nНесколько значений — через запятую: `test1.com,test2.com` или `1.2.3.4,10.0.0.0/8`",
    checkFailedReason: (reason: string) => `Причина: ${reason}`,
  },

  checkProgress: {
    title: "⏳ Проверка доступа",
    steps: {
      env: "Переменные окружения GitHub",
      repo: "Доступ к репозиторию",
      permissions: "Права на запись в репозиторий",
      branch: (branch: string) => `Ветка \`${branch}\``,
      domainFile: `Файл \`${DOMAIN_LIST_FILE}\` в корне репозитория`,
      ipFile: `Файл \`${IP_LIST_FILE}\` в корне репозитория`,
    },
    failedHeader: "❌ Проверка не пройдена",
    withError: (progressText: string, errorText: string) =>
      [progressText, "", errorText].join("\n"),
  },

  access: {
    ok: (repo: string, branch: string) =>
      `✅ Доступ к репозиторию подтверждён\nРепозиторий: \`${repo}\`\nВетка: \`${branch}\``,

    error: (result: AccessCheckResult): string => {
      switch (result.status) {
        case "env_missing":
          return [
            "❌ Не настроены переменные окружения GitHub.",
            "Укажите `GITHUB_TOKEN`, `GITHUB_USERNAME`, `GITHUB_REPO` и при необходимости `GITHUB_BRANCH`.",
          ].join("\n");
        case "unauthorized":
          return [
            "❌ Не удалось авторизоваться в GitHub.",
            "Проверьте корректность `GITHUB_TOKEN` и срок его действия.",
          ].join("\n");
        case "repo_not_found":
          return [
            "❌ Репозиторий не найден.",
            "Проверьте значения `GITHUB_USERNAME` и `GITHUB_REPO`.",
          ].join("\n");
        case "forbidden":
          return [
            "❌ Нет доступа к репозиторию.",
            "Убедитесь, что токен имеет доступ к указанному репозиторию.",
          ].join("\n");
        case "no_push":
          return [
            "❌ Недостаточно прав для записи в репозиторий.",
            "Для fine-grained токена включите Repository permissions → Contents: Read and write.",
          ].join("\n");
        case "branch_not_found":
          return [
            `❌ Ветка \`${result.branch}\` не найдена в репозитории.`,
            "Проверьте значение `GITHUB_BRANCH`.",
          ].join("\n");
        case "unknown":
          return `❌ Ошибка при проверке доступа: ${result.message}`;
        default:
          return "❌ Неизвестная ошибка при проверке доступа.";
      }
    },
  },

  files: {
    found: (fileName: string) => `✅ \`${fileName}\` — найден`,
    notFound: (fileName: string) =>
      `⚠️ \`${fileName}\` — не найден в корневом каталоге`,
    notFoundOnAdd: (fileName: string) =>
      `Файл ${fileName} в корневом каталоге не найден. Создайте его и повторите процесс добавления`,
    missingLists: (missingFiles: string[]) =>
      [
        "❌ Не найдены файлы списков в корне репозитория:",
        ...missingFiles.map((fileName) => `• \`${fileName}\``),
        "",
        "Создайте недостающие файлы и повторите команду /start.",
        "Добавление доменов и IP недоступно, пока файлы отсутствуют.",
      ].join("\n"),
    tooLarge: (fileName: string, sizeBytes: number) => {
      const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);

      return [
        `❌ Файл \`${fileName}\` слишком большой (${sizeMb} МБ).`,
        "Лимит GitHub Contents API — 1 МБ.",
        "Добавление через бота недоступно, пока файл не уменьшится.",
      ].join("\n");
    },
  },

  entry: {
    invalidFormat:
      "Некорректный формат. Отправьте домен `example.com` или IP/CIDR.\nНесколько значений — через запятую: `test1.com,test2.com` или `1.2.3.4,10.0.0.0/8`",
    mixedTypes:
      "Нельзя смешивать домены и IP в одном сообщении. Отправьте только домены или только IP.",
    invalidItems: (items: string[]) =>
      [
        "Некорректные значения:",
        ...items.map((item) => `• \`${item}\``),
        "",
        "Пример: `test1.com,test.test1.com` или `1.2.3.4,10.0.0.0/8`",
      ].join("\n"),
    checking: (values: string[]) =>
      `⏳ Проверяем: ${values.map((value) => `\`${value}\``).join(", ")}...`,
    allExist: (type: EntryType, values: string[]) =>
      [
        type === "domain"
          ? "Все домены уже есть в списке:"
          : "Все IP уже есть в списке:",
        ...values.map((value) => `• \`${value}\``),
      ].join("\n"),
    addFailed: (values: string[], reason: string, sessionReset = false) => {
      const lines = [
        `❌ Не удалось добавить: ${values.map((value) => `\`${value}\``).join(", ")}.`,
        `Причина: ${reason}`,
      ];

      if (sessionReset) {
        lines.push("", TEXTS.entry.sessionResetHint);
      }

      return lines.join("\n");
    },
    sessionResetHint:
      "Сессия сброшена. Обновите `GITHUB_TOKEN` и выполните /start.",
    typeLabel: (type: EntryType) => (type === "domain" ? "домен" : "IP"),
    added: (
      fileName: string,
      changes: string[],
      skipped: string[] = [],
    ) => {
      const lines = ["✅ Успешно добавлено"];

      if (skipped.length > 0) {
        lines.push(
          "",
          "Пропущено (уже в списке):",
          ...skipped.map((value) => `  ${value}`),
        );
      }

      lines.push(
        "",
        `Изменённый список: ${fileName}`,
        "Изменения:",
        ...changes.map((change) => `  ${change}`),
      );

      return lines.join("\n");
    },
  },
} as const;
