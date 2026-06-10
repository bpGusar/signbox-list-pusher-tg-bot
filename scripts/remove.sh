#!/usr/bin/env bash

# Удаление из любого места (после install.sh):
#   curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/remove.sh | bash
#
# Или из папки проекта:
#   ~/signbox-list-pusher-tg-bot/scripts/remove.sh

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
  local_script="${install_dir}/scripts/remove.sh"

  if [[ -f "${local_script}" ]]; then
    exec bash "${local_script}" "$@"
  fi

  printf '!!> Проект не найден в %s\n' "${install_dir}" >&2
  printf '!!> Сначала выполните установку или укажите INSTALL_DIR.\n' >&2
  exit 1
}

if needs_bootstrap; then
  bootstrap_maintenance "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

container_exists() {
  docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "$1"
}

image_exists() {
  docker image inspect "$1" &>/dev/null
}

confirm() {
  local answer=""
  read -rp "$1 [y/N]: " answer
  [[ "${answer}" =~ ^[Yy]$ ]]
}

stop_compose_project() {
  local profile="$1"
  if [[ ! -f "${REPO_ROOT}/docker-compose.yml" ]]; then
    return 0
  fi

  info "Останавливаю compose-профиль '${profile}' в ${REPO_ROOT}..."
  docker compose --profile "${profile}" down --rmi local --remove-orphans 2>/dev/null || true
}

remove_named_container() {
  local name="$1"
  if container_exists "${name}"; then
    info "Удаляю контейнер: ${name}"
    docker rm -f "${name}"
  fi
}

remove_named_image() {
  local name="$1"
  if image_exists "${name}"; then
    info "Удаляю образ: ${name}"
    docker rmi "${name}" 2>/dev/null || docker rmi -f "${name}"
  fi
}

remove_dangling_project_images() {
  local repo="$1"
  local ids
  ids="$(docker images -f "dangling=true" --format '{{.ID}} {{.Repository}}' 2>/dev/null \
    | awk -v repo="${repo}" '$2 == repo { print $1 }' || true)"

  if [[ -z "${ids}" ]]; then
    return 0
  fi

  info "Удаляю dangling-образы репозитория ${repo}..."
  # shellcheck disable=SC2086
  docker rmi ${ids} 2>/dev/null || true
}

remove_project_directory() {
  local parent dir_name
  parent="$(dirname "${REPO_ROOT}")"
  dir_name="$(basename "${REPO_ROOT}")"

  info "Будет удалена папка: ${REPO_ROOT}"
  warn "Скрипт remove.sh тоже находится внутри этой папки и будет удалён."

  if ! confirm "Удалить папку проекта?"; then
    info "Папка проекта сохранена."
    return 0
  fi

  cd "${parent}"
  rm -rf "${dir_name}"
  info "Папка ${REPO_ROOT} удалена."
}

main() {
  local repo_found=false
  if REPO_ROOT="$(resolve_repo_root)"; then
    repo_found=true
  else
    REPO_ROOT=""
  fi

  warn "Этот скрипт удалит только ресурсы бота ${BOT_CONTAINER_PROD}:"
  warn "  - контейнеры: ${BOT_CONTAINER_PROD}, ${BOT_CONTAINER_DEV}"
  warn "  - образы:    ${BOT_IMAGE_PROD}, ${BOT_IMAGE_DEV}"
  if [[ "${repo_found}" == true ]]; then
    warn "  - (опционально) папку: ${REPO_ROOT}"
  fi
  warn "  - файл метки: ${INSTALL_MARKER_FILE}"
  warn "Другие Docker-контейнеры и образы на сервере не затрагиваются."

  if ! confirm "Продолжить удаление?"; then
    info "Отменено."
    exit 0
  fi

  if [[ "${repo_found}" == true && -d "${REPO_ROOT}" ]]; then
    cd "${REPO_ROOT}"
    stop_compose_project "prod"
    stop_compose_project "dev"
  else
    warn "Папка проекта не найдена — удаляю только Docker-ресурсы по имени."
  fi

  remove_named_container "${BOT_CONTAINER_PROD}"
  remove_named_container "${BOT_CONTAINER_DEV}"
  remove_named_image "${BOT_IMAGE_PROD}"
  remove_named_image "${BOT_IMAGE_DEV}"
  remove_dangling_project_images "${BOT_IMAGE_PROD}"
  remove_dangling_project_images "${BOT_IMAGE_DEV}"

  if [[ "${repo_found}" == true && -d "${REPO_ROOT}" ]]; then
    remove_project_directory
  fi

  remove_install_dir_marker

  info "Готово. Ресурсы бота удалены."
}

main "$@"
