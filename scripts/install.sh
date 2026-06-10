#!/usr/bin/env bash

# Одной командой с VPS (без git clone вручную):
#   curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/install.sh | bash
#
# Приватный репозиторий (SSH):
#   REPO_URL=git@github.com:USER/signbox-list-pusher-tg-bot.git curl -fsSL .../install.sh | bash
#
# По умолчанию установка в текущую папку (pwd). Своя папка:
#   INSTALL_DIR=~/my-bot curl -fsSL .../install.sh | bash

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

bootstrap_install() {
  set -e

  local install_dir repo_url branch local_install
  if [[ -n "${INSTALL_DIR:-}" ]]; then
    install_dir="$(cd "${INSTALL_DIR}" && pwd)"
  else
    install_dir="$(pwd)"
  fi
  repo_url="${REPO_URL:-https://github.com/bpGusar/signbox-list-pusher-tg-bot.git}"
  branch="${REPO_BRANCH:-main}"
  local_install="${install_dir}/scripts/install.sh"

  if [[ -f "${local_install}" ]]; then
    exec env INSTALL_DIR="${install_dir}" bash "${local_install}" "$@"
  fi

  if ! command -v git &>/dev/null; then
    printf '==> Git не найден — устанавливаю...\n'
    if command -v apt-get &>/dev/null; then
      sudo apt-get update -qq
      sudo apt-get install -y git
    elif command -v dnf &>/dev/null; then
      sudo dnf install -y git
    elif command -v yum &>/dev/null; then
      sudo yum install -y git
    else
      printf '!!> Не удалось установить git автоматически.\n' >&2
      exit 1
    fi
  fi

  if [[ -e "${install_dir}" && ! -d "${install_dir}/.git" && -n "$(ls -A "${install_dir}" 2>/dev/null)" ]]; then
    printf '!!> Папка %s не пуста. Создайте пустую папку, перейдите в неё (cd) и запустите установку снова.\n' "${install_dir}" >&2
    exit 1
  fi

  if [[ ! -d "${install_dir}/.git" ]]; then
    printf '==> Клонирую репозиторий...\n'
    printf '    URL:    %s\n' "${repo_url}"
    printf '    Ветка:  %s\n' "${branch}"
    printf '    Папка:  %s\n' "${install_dir}"
    git clone --branch "${branch}" --depth 1 "${repo_url}" "${install_dir}"
  fi

  if [[ ! -f "${local_install}" ]]; then
    printf '!!> После клонирования не найден %s\n' "${local_install}" >&2
    exit 1
  fi

  exec env INSTALL_DIR="${install_dir}" bash "${local_install}" "$@"
}

if needs_bootstrap; then
  bootstrap_install "$@"
fi

set -euo pipefail

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
  local repo_root

  if ! repo_root="$(resolve_repo_root)"; then
    die "Не удалось найти корень проекта. Запустите install.sh из репозитория или через curl."
  fi

  REPO_ROOT="${repo_root}"
  cd "${REPO_ROOT}"

  info "Корень проекта: ${REPO_ROOT}"
  save_install_dir_marker "${REPO_ROOT}"
  ensure_docker
  ensure_compose
  create_env_file
  start_bot
}

main "$@"
