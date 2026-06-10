#!/usr/bin/env bash
set -euo pipefail

# Удаление из любого места (после install.sh):
#   curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/remove.sh | bash
#
# Или из папки проекта:
#   ~/signbox-list-pusher-tg-bot/scripts/remove.sh

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
  # --rmi local: только образы, собранные этим compose-проектом в этой папке.
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

  info "Готово. Ресурсы бота удалены."
}

main "$@"
