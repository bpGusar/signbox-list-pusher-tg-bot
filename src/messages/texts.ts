import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import type { AccessCheckResult } from "../github/access";
import type { EntryType } from "../utils/validation";

export const TEXTS = {
  start: {
    prompt: "Отправьте домен в формате `example.com` или IP",
    checkFailedReason: (reason: string) => `Причина: ${reason}`,
  },

  checkProgress: {
    title: "⏳ Проверка доступа",
    steps: {
      env: "Переменные окружения GitHub",
      repo: "Доступ к репозиторию",
      permissions: "Права на запись",
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
            "Токену нужны права на чтение и запись (push) в репозиторий.",
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
  },

  entry: {
    invalidFormat:
      "Некорректный формат. Отправьте домен в формате `example.com` или IP",
    checking: (typeLabel: string, value: string) =>
      `⏳ Проверяем ${typeLabel} \`${value}\`...`,
    domainExists: "Такой домен уже существует в списке",
    ipExists: "Такой IP уже существует в списке",
    addFailed: (typeLabel: string, value: string) =>
      `❌ Не удалось добавить ${typeLabel} \`${value}\`. Попробуйте позже.`,
    typeLabel: (type: EntryType) => (type === "domain" ? "домен" : "IP"),
    added: (fileName: string, changes: string[]) =>
      [
        "✅ Успешно добавлено",
        "",
        `Изменённый список: ${fileName}`,
        "Изменения:",
        ...changes.map((change) => `  ${change}`),
      ].join("\n"),
  },
} as const;
