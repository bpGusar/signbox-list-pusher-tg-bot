#!/usr/bin/env bash
# Общие константы и функции для install/update/remove.
# shellcheck shell=bash

readonly BOT_CONTAINER_PROD="signbox-list-pusher-tg-bot"
readonly BOT_CONTAINER_DEV="signbox-list-pusher-tg-bot-dev"
readonly BOT_IMAGE_PROD="signbox-list-pusher-tg-bot"
readonly BOT_IMAGE_DEV="signbox-list-pusher-tg-bot-dev"

readonly DEFAULT_REPO_URL="https://github.com/bpGusar/signbox-list-pusher-tg-bot.git"
readonly DEFAULT_REPO_BRANCH="main"
readonly DEFAULT_INSTALL_DIR="${HOME}/signbox-list-pusher-tg-bot"

info() { printf '==> %s\n' "$*"; }
warn() { printf '!!> %s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

default_install_dir() {
  printf '%s\n' "${INSTALL_DIR:-${DEFAULT_INSTALL_DIR}}"
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

  if [[ -e "${install_dir}" ]]; then
    die "Путь ${install_dir} уже существует, но это не git-репозиторий. Укажите другой INSTALL_DIR."
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
