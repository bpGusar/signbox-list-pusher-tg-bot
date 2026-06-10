#!/usr/bin/env bash

# Обновление из любого места (после install.sh):
#   curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/update.sh | bash
#
# Или из папки проекта:
#   ~/signbox-list-pusher-tg-bot/scripts/update.sh

needs_bootstrap() {
  local self="${BASH_SOURCE[0]:-}"
  local script_dir=""

  if [[ -z "${self}" || "${self}" == "bash" || ! -f "${self}" ]]; then
    return 0
  fi

  script_dir="$(cd "$(dirname "${self}")" && pwd)"
  if [[ ! -f "${script_dir}/common.sh" ]]; then
    return 0
  fi

  if [[ -f "${script_dir}/../docker-compose.yml" ]]; then
    return 1
  fi

  return 0
}

bootstrap_repo_name_from_url() {
  local url="${1:-https://github.com/bpGusar/signbox-list-pusher-tg-bot.git}" name="${url%/}"

  name="${name##*/}"
  name="${name%.git}"
  printf '%s\n' "${name:-signbox-list-pusher-tg-bot}"
}

bootstrap_resolve_install_dir() {
  local install_dir marker_file="${HOME}/.local/share/signbox-list-pusher-tg-bot/install_dir"
  local repo_url repo_name

  if [[ -n "${INSTALL_DIR:-}" ]]; then
    install_dir="${INSTALL_DIR/#\~/$HOME}"
    if [[ -d "${install_dir}" ]]; then
      cd "${install_dir}" && pwd
      return 0
    fi
    printf '%s\n' "${install_dir}"
    return 0
  fi

  if [[ -f "${marker_file}" ]]; then
    install_dir="$(tr -d '\n' <"${marker_file}")"
    if [[ -f "${install_dir}/docker-compose.yml" ]]; then
      printf '%s\n' "${install_dir}"
      return 0
    fi
  fi

  repo_url="${REPO_URL:-https://github.com/bpGusar/signbox-list-pusher-tg-bot.git}"
  repo_name="$(bootstrap_repo_name_from_url "${repo_url}")"
  install_dir="$(pwd)/${repo_name}"
  if [[ -f "${install_dir}/docker-compose.yml" ]]; then
    printf '%s\n' "${install_dir}"
    return 0
  fi

  printf '%s\n' "${install_dir}"
}

bootstrap_maintenance() {
  set -e

  local install_dir local_script
  install_dir="$(bootstrap_resolve_install_dir)"
  local_script="${install_dir}/scripts/update.sh"

  if [[ -f "${local_script}" ]]; then
    exec bash "${local_script}" "$@"
  fi

  printf '!!> Проект не найден в %s\n' "${install_dir}" >&2
  printf '!!> Сначала выполните установку:\n' >&2
  printf '    curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/install.sh | bash\n' >&2
  exit 1
}

if needs_bootstrap; then
  bootstrap_maintenance "$@"
fi

set -euo pipefail

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
