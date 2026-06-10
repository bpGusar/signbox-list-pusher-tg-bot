#!/usr/bin/env bash
# Общие константы и функции для install/update/remove.
# shellcheck shell=bash

readonly BOT_CONTAINER_PROD="signbox-list-pusher-tg-bot"
readonly BOT_CONTAINER_DEV="signbox-list-pusher-tg-bot-dev"
readonly BOT_IMAGE_PROD="signbox-list-pusher-tg-bot"
readonly BOT_IMAGE_DEV="signbox-list-pusher-tg-bot-dev"

readonly DEFAULT_REPO_URL="https://github.com/bpGusar/signbox-list-pusher-tg-bot.git"
readonly DEFAULT_REPO_BRANCH="main"
readonly INSTALL_MARKER_FILE="${HOME}/.local/share/signbox-list-pusher-tg-bot/install_dir"

info() { printf '==> %s\n' "$*"; }
warn() { printf '!!> %s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

repo_name_from_url() {
  local url="${1:-${REPO_URL:-${DEFAULT_REPO_URL}}}"
  local name="${url%/}"

  name="${name##*/}"
  name="${name%.git}"

  if [[ -z "${name}" ]]; then
    name="signbox-list-pusher-tg-bot"
  fi

  printf '%s\n' "${name}"
}

expand_install_path() {
  local path="$1"

  path="${path/#\~/$HOME}"

  if [[ -d "${path}" ]]; then
    cd "${path}" && pwd
    return 0
  fi

  printf '%s\n' "${path}"
}

default_install_dir() {
  local repo_url repo_name parent_dir

  if [[ -n "${INSTALL_DIR:-}" ]]; then
    expand_install_path "${INSTALL_DIR}"
    return 0
  fi

  repo_url="${REPO_URL:-${DEFAULT_REPO_URL}}"
  repo_name="$(repo_name_from_url "${repo_url}")"
  parent_dir="$(pwd)"
  printf '%s\n' "${parent_dir}/${repo_name}"
}

save_install_dir_marker() {
  local install_dir="$1"
  mkdir -p "$(dirname "${INSTALL_MARKER_FILE}")"
  printf '%s\n' "${install_dir}" >"${INSTALL_MARKER_FILE}"
}

remove_install_dir_marker() {
  local marker_dir
  marker_dir="$(dirname "${INSTALL_MARKER_FILE}")"

  if [[ -f "${INSTALL_MARKER_FILE}" ]]; then
    rm -f "${INSTALL_MARKER_FILE}"
    info "Удалён файл метки установки: ${INSTALL_MARKER_FILE}"
  fi

  if [[ -d "${marker_dir}" && -z "$(ls -A "${marker_dir}" 2>/dev/null)" ]]; then
    rmdir "${marker_dir}" 2>/dev/null || true
  fi
}

find_saved_install_dir() {
  local install_dir=""

  if [[ ! -f "${INSTALL_MARKER_FILE}" ]]; then
    return 1
  fi

  install_dir="$(tr -d '\n' <"${INSTALL_MARKER_FILE}")"
  if [[ -f "${install_dir}/docker-compose.yml" ]]; then
    printf '%s\n' "${install_dir}"
    return 0
  fi

  return 1
}

script_path() {
  if [[ -n "${BASH_SOURCE[1]:-}" && "${BASH_SOURCE[1]}" != "bash" ]]; then
    local path="${BASH_SOURCE[1]}"
    if [[ -f "${path}" ]]; then
      cd "$(dirname "${path}")" && pwd
      return 0
    fi
  fi

  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "bash" ]]; then
    local path="${BASH_SOURCE[0]}"
    if [[ -f "${path}" ]]; then
      cd "$(dirname "${path}")" && pwd
      return 0
    fi
  fi

  printf '\n'
}

find_repo_root_from_path() {
  local base_dir="$1"

  if [[ -z "${base_dir}" ]]; then
    return 1
  fi

  if [[ -f "${base_dir}/docker-compose.yml" ]]; then
    printf '%s\n' "${base_dir}"
    return 0
  fi

  if [[ -f "${base_dir}/../docker-compose.yml" ]]; then
    cd "${base_dir}/.." && pwd
    return 0
  fi

  return 1
}

find_repo_root_from_cwd() {
  if [[ -f "./docker-compose.yml" ]]; then
    pwd
    return 0
  fi
  return 1
}

find_installed_repo_root() {
  local install_dir
  install_dir="$(default_install_dir)"

  if [[ -f "${install_dir}/docker-compose.yml" ]]; then
    printf '%s\n' "${install_dir}"
    return 0
  fi

  return 1
}

resolve_repo_root() {
  local script_dir repo_root

  script_dir="$(script_path)"
  if repo_root="$(find_repo_root_from_path "${script_dir}")"; then
    printf '%s\n' "${repo_root}"
    return 0
  fi

  if repo_root="$(find_repo_root_from_cwd)"; then
    printf '%s\n' "${repo_root}"
    return 0
  fi

  if repo_root="$(find_saved_install_dir)"; then
    printf '%s\n' "${repo_root}"
    return 0
  fi

  if repo_root="$(find_installed_repo_root)"; then
    printf '%s\n' "${repo_root}"
    return 0
  fi

  return 1
}

ensure_git() {
  if command -v git &>/dev/null; then
    return 0
  fi

  if [[ "$(uname -s)" != "Linux" ]]; then
    die "Git не найден. Установите git вручную."
  fi

  info "Git не найден — устанавливаю..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y git
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y git
  elif command -v yum &>/dev/null; then
    sudo yum install -y git
  else
    die "Не удалось установить git автоматически. Установите git вручную."
  fi
}

clone_or_update_repo() {
  local install_dir repo_url branch
  install_dir="$(default_install_dir)"
  repo_url="${REPO_URL:-${DEFAULT_REPO_URL}}"
  branch="${REPO_BRANCH:-${DEFAULT_REPO_BRANCH}}"

  ensure_git

  if [[ -d "${install_dir}/.git" ]]; then
    info "Репозиторий уже установлен в ${install_dir} — обновляю..."
    git -C "${install_dir}" fetch origin "${branch}"
    git -C "${install_dir}" checkout "${branch}"
    git -C "${install_dir}" pull --ff-only origin "${branch}"
    printf '%s\n' "${install_dir}"
    return 0
  fi

  if [[ -e "${install_dir}" && ! -d "${install_dir}/.git" ]]; then
    if [[ -n "$(ls -A "${install_dir}" 2>/dev/null)" ]]; then
      die "Папка ${install_dir} уже существует и не пуста. Удалите её или укажите другой INSTALL_DIR."
    fi
  fi

  info "Клонирую репозиторий..."
  info "  URL:    ${repo_url}"
  info "  Ветка:  ${branch}"
  info "  Папка:  ${install_dir}"
  git clone --branch "${branch}" --depth 1 "${repo_url}" "${install_dir}"
  printf '%s\n' "${install_dir}"
}

ensure_repo_for_maintenance() {
  local repo_root
  if repo_root="$(resolve_repo_root)"; then
    printf '%s\n' "${repo_root}"
    return 0
  fi

  die "Проект не найден. Сначала выполните установку:

  curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/install.sh | bash

  или укажите путь: INSTALL_DIR=~/my-bot ./scripts/update.sh"
}
