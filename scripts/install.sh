#!/usr/bin/env bash
set -euo pipefail

# Одной командой с VPS (без git clone вручную):
#   curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/install.sh | bash
#
# Приватный репозиторий (SSH):
#   REPO_URL=git@github.com:USER/signbox-list-pusher-tg-bot.git bash install.sh
#
# Своя папка установки:
#   INSTALL_DIR=~/my-bot curl -fsSL .../install.sh | bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

ensure_docker() {
  if command -v docker &>/dev/null; then
    info "Docker уже установлен: $(docker --version)"
    return 0
  fi

  if [[ "$(uname -s)" != "Linux" ]]; then
    die "Docker не найден. Установите Docker вручную для вашей ОС."
  fi

  info "Docker не найден — устанавливаю (get.docker.com)..."
  curl -fsSL https://get.docker.com | sh

  if command -v systemctl &>/dev/null; then
    sudo systemctl enable --now docker
  fi

  if groups "${USER}" 2>/dev/null | grep -q '\bdocker\b'; then
    info "Пользователь ${USER} уже в группе docker."
  else
    warn "Добавляю ${USER} в группу docker (может потребоваться перелогин)."
    sudo usermod -aG docker "${USER}" || true
  fi
}

ensure_compose() {
  if docker compose version &>/dev/null; then
    info "Docker Compose: $(docker compose version --short 2>/dev/null || docker compose version)"
    return 0
  fi

  die "Команда 'docker compose' недоступна. Обновите Docker или установите compose plugin."
}

prompt_env_value() {
  local name="$1"
  local default="${2:-}"
  local value=""
  local prompt="  ${name}"

  if [[ -n "${default}" ]]; then
    prompt+=" [${default}]"
  fi
  prompt+=": "

  read -rp "${prompt}" value
  if [[ -z "${value}" && -n "${default}" ]]; then
    value="${default}"
  fi

  if [[ -z "${value}" ]]; then
    die "Переменная ${name} обязательна."
  fi

  printf '%s' "${value}"
}

create_env_file() {
  local env_file="${REPO_ROOT}/.env"

  if [[ -f "${env_file}" ]]; then
    info "Файл .env уже существует — пропускаю создание."
    chmod 600 "${env_file}"
    return 0
  fi

  if [[ ! -f "${REPO_ROOT}/.env.example" ]]; then
    die "Не найден .env.example в ${REPO_ROOT}"
  fi

  info "Создаю .env (значения не сохраняются в git)."
  printf '\nВведите значения для .env:\n'

  local bot_token github_token github_username github_repo github_branch
  bot_token="$(prompt_env_value "BOT_TOKEN")"
  github_token="$(prompt_env_value "GITHUB_TOKEN")"
  github_username="$(prompt_env_value "GITHUB_USERNAME")"
  github_repo="$(prompt_env_value "GITHUB_REPO")"
  github_branch="$(prompt_env_value "GITHUB_BRANCH" "main")"

  cat >"${env_file}" <<EOF
BOT_TOKEN=${bot_token}

# github credentials
GITHUB_TOKEN=${github_token}
GITHUB_USERNAME=${github_username}
GITHUB_REPO=${github_repo}
GITHUB_BRANCH=${github_branch}
EOF

  chmod 600 "${env_file}"
  info "Файл .env создан (права 600)."
}

start_bot() {
  info "Сборка и запуск production-контейнера..."
  docker compose --profile prod up -d --build

  info "Статус контейнера:"
  docker compose --profile prod ps

  info "Последние логи:"
  docker compose --profile prod logs --tail=30 bot
  info "Логи в реальном времени: docker compose --profile prod logs -f bot"
  info "Обновление позже: ${REPO_ROOT}/scripts/update.sh"
  info "Удаление:         ${REPO_ROOT}/scripts/remove.sh"
}

main() {
  local repo_root script_dir install_script

  if repo_root="$(resolve_repo_root)"; then
    :
  else
    repo_root="$(clone_or_update_repo)"
    script_dir="$(script_path)"
    install_script="${repo_root}/scripts/install.sh"

    if [[ ! -f "${install_script}" ]]; then
      die "После клонирования не найден ${install_script}"
    fi

    # curl ... | bash — перезапускаем скрипт из клонированного репозитория.
    if [[ "${script_dir}" != "${repo_root}/scripts" ]]; then
      info "Перезапускаю установку из ${install_script}"
      exec bash "${install_script}" "$@"
    fi
  fi

  REPO_ROOT="${repo_root}"
  cd "${REPO_ROOT}"

  info "Корень проекта: ${REPO_ROOT}"
  ensure_docker
  ensure_compose
  create_env_file
  start_bot
}

main "$@"
