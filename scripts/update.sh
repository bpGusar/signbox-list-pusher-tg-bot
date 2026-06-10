#!/usr/bin/env bash
set -euo pipefail

# Обновление из любого места (после install.sh):
#   curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/update.sh | bash
#
# Или из папки проекта:
#   ~/signbox-list-pusher-tg-bot/scripts/update.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

ensure_compose() {
  if docker compose version &>/dev/null; then
    return 0
  fi
  die "Команда 'docker compose' недоступна."
}

pull_changes() {
  if [[ ! -d "${REPO_ROOT}/.git" ]]; then
    warn "Каталог .git не найден — пропускаю git pull."
    return 0
  fi

  info "Получаю изменения из git..."
  git pull --ff-only
}

rebuild_and_restart() {
  if [[ ! -f "${REPO_ROOT}/.env" ]]; then
    die "Не найден .env. Сначала выполните install.sh"
  fi

  info "Пересборка и перезапуск production-контейнера..."
  docker compose --profile prod up -d --build

  info "Статус:"
  docker compose --profile prod ps

  info "Последние логи:"
  docker compose --profile prod logs --tail=20 bot
}

main() {
  REPO_ROOT="$(ensure_repo_for_maintenance)"
  cd "${REPO_ROOT}"

  info "Корень проекта: ${REPO_ROOT}"
  ensure_compose
  pull_changes
  rebuild_and_restart
}

main "$@"
