# signbox-list-pusher-tg-bot

Telegram-бот для добавления доменов и IP/CIDR в списки GitHub-репозитория (`domain_list.lst`, `ip_list.lst`).

Стек: Node.js, [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api), GitHub Contents API.

## Оглавление

- [Требования](#требования)
- [Установка](#установка)
- [Настройка](#настройка)
- [Использование](#использование)
- [Запуск локально](#запуск-локально)
- [Запуск в Docker](#запуск-в-docker)
  - [Production](#production)
  - [Разработка с автоподтягиванием изменений](#разработка-с-автоподтягиванием-изменений)
  - [Полезные Docker-команды](#полезные-docker-команды)
- [Деплой на VPS](#деплой-на-vps)
  - [Предварительные требования](#предварительные-требования)
  - [Автоматическая установка (рекомендуется)](#автоматическая-установка-рекомендуется)
  - [Переменные установки](#переменные-установки)
  - [Обновление и удаление](#обновление-и-удаление)
  - [Ручной деплой](#ручной-деплой)
  - [Эксплуатация](#эксплуатация)
  - [Безопасность](#безопасность)

## Требования

- Node.js 18+
- Yarn 4
- Docker и Docker Compose (для запуска в контейнере)

## Установка

```bash
yarn install
```

## Настройка

1. Создайте бота через [@BotFather](https://t.me/BotFather) и получите токен.git
2. Создайте fine-grained или classic GitHub token с правом **Contents: Read and write** для целевого репозитория.
3. В корне репозитория должны существовать файлы `domain_list.lst` и `ip_list.lst`.
4. Скопируйте `.env.example` в `.env` и заполните переменные:

```bash
cp .env.example .env
```

```env
BOT_TOKEN=123456:ABC-DEF...
GITHUB_TOKEN=ghp_...
GITHUB_USERNAME=your_username
GITHUB_REPO=your_repo
GITHUB_BRANCH=main
```

## Использование

1. Отправьте боту `/start` — он проверит доступ к GitHub и наличие файлов списков.
2. Отправьте домен (`example.com`) или IP/CIDR (`1.2.3.4`, `10.0.0.0/8`).
3. Несколько значений в одном сообщении — через запятую: `test1.com,test2.com` или `1.2.3.4,10.0.0.0/8`.
4. Домены и IP нельзя смешивать в одном сообщении.

При добавлении бот создаёт лаконичный коммит с количеством новых записей, например: `Add 3 domains`, `Add 1 IP`.

## Запуск локально

Разработка (с автоперезагрузкой при изменении `src/` и `.env`):

```bash
yarn dev
```

Сборка и запуск:

```bash
yarn build
yarn start
```

Проверка типов:

```bash
yarn typecheck
```

## Запуск в Docker

### Production

Сборка и запуск бота в фоне:

```bash
docker compose --profile prod up -d --build
```

Просмотр логов:

```bash
docker compose --profile prod logs -f bot
```

Остановка:

```bash
docker compose --profile prod down
```

Пересборка после изменений в `package.json` или `Dockerfile`:

```bash
docker compose --profile prod up -d --build
```

### Разработка с автоподтягиванием изменений

Есть два способа — выберите один.

#### Способ 1: `docker compose watch` (рекомендуется на Windows)

Docker Compose следит за файлами на хосте и синхронизирует `src/` в контейнер, после чего перезапускает бота. Изменения в `.env` тоже вызывают перезапуск контейнера.

```bash
docker compose --profile dev watch
```

Остановка: `Ctrl+C`.

При изменении `package.json` или `yarn.lock` образ пересобирается автоматически.

#### Способ 2: volume + `tsx watch`

Папка `src/` монтируется в контейнер, внутри работает `tsx watch`, который перезапускает процесс при изменении файлов. Для Windows включён polling (`CHOKIDAR_USEPOLLING`).

```bash
docker compose --profile dev up --build
```

Просмотр логов:

```bash
docker compose --profile dev logs -f bot-dev
```

Остановка:

```bash
docker compose --profile dev down
```

После правок в `src/` или `.env` бот перезапустится сам — пересобирать образ не нужно.

> Если изменения не подхватываются, используйте способ 1 (`docker compose watch`) или перезапустите контейнер:
>
> ```bash
> docker compose --profile dev restart bot-dev
> ```

### Полезные Docker-команды


| Команда                                        | Описание                              |
| ---------------------------------------------- | ------------------------------------- |
| `docker compose --profile prod up -d --build`  | Запуск production-бота                |
| `docker compose --profile dev watch`           | Разработка с авто-синхронизацией кода |
| `docker compose --profile dev up --build`      | Разработка с volume и hot-reload      |
| `docker compose --profile prod logs -f bot`    | Логи production                       |
| `docker compose --profile dev logs -f bot-dev` | Логи dev-контейнера                   |
| `docker compose --profile prod down`           | Остановить production                 |
| `docker compose --profile dev down`            | Остановить dev                        |
| `docker compose build --no-cache`              | Полная пересборка образа              |


## Деплой на VPS

Инструкция для запуска бота на сервере в Docker-контейнере.

### Предварительные требования

- Выполнена [настройка](#настройка): токены Telegram и GitHub, файлы `domain_list.lst` и `ip_list.lst` в целевом репозитории.
- Linux-сервер с доступом по SSH.
- Открывать входящие порты не нужно — бот работает через long polling (исходящие HTTPS-запросы к Telegram и GitHub).

Docker, Git и клонирование репозитория скрипт установит сам (см. ниже).

### Автоматическая установка (рекомендуется)

На VPS выполните одну команду — `git clone` вручную не нужен:

```bash
curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/install.sh | bash
```

Скрипт `scripts/install.sh`:

1. Установит Docker и Git (если их нет).
2. Склонирует репозиторий в папку установки (по умолчанию `~/signbox-list-pusher-tg-bot`).
3. Спросит значения для `.env` и создаст файл с правами `600`.
4. Соберёт образ и запустит production-контейнер.

В логах должно появиться `Bot is running...`. Отправьте боту `/start` в Telegram для проверки доступа к GitHub.

Контейнер настроен с `restart: unless-stopped` — после перезагрузки VPS Docker поднимет бота автоматически (если включён сервис Docker: `sudo systemctl enable docker`).

### Переменные установки

Передаются **перед** командой установки. Если не указаны — используются значения по умолчанию.

| Переменная    | По умолчанию                                              | Описание |
| ------------- | --------------------------------------------------------- | -------- |
| `INSTALL_DIR` | `~/signbox-list-pusher-tg-bot`                            | Папка на сервере, куда клонируется проект |
| `REPO_URL`    | `https://github.com/bpGusar/signbox-list-pusher-tg-bot.git` | URL git-репозитория |
| `REPO_BRANCH` | `main`                                                    | Ветка для клонирования |

**`INSTALL_DIR`** — путь к папке проекта на VPS. Если переменную не задавать, проект установится в домашнюю директорию **текущего пользователя** (`$HOME`), в подпапку `signbox-list-pusher-tg-bot`. Это не «текущая папка в терминале», а именно домашний каталог пользователя, под которым вы выполнили команду (например, `/home/ubuntu/signbox-list-pusher-tg-bot`).

Примеры:

```bash
# Установка в домашнюю папку пользователя (по умолчанию)
curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/install.sh | bash

# Установка в свою папку
INSTALL_DIR=~/bots/tg-pusher curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/install.sh | bash

# Приватный репозиторий (нужен SSH-ключ на сервере)
REPO_URL=git@github.com:USER/signbox-list-pusher-tg-bot.git curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/install.sh | bash
```

Скрипты `update.sh` и `remove.sh` тоже ищут проект в `INSTALL_DIR` или в `~/signbox-list-pusher-tg-bot`, если переменная не задана.

### Обновление и удаление

**Обновление** (git pull + пересборка контейнера):

```bash
curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/update.sh | bash
```

Или из папки проекта:

```bash
~/signbox-list-pusher-tg-bot/scripts/update.sh
```

Если проект установлен в другую папку:

```bash
INSTALL_DIR=~/bots/tg-pusher curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/update.sh | bash
```

**Полное удаление** бота (контейнеры и образы с именами из `docker-compose.yml`; опционально — папка проекта):

```bash
curl -fsSL https://raw.githubusercontent.com/bpGusar/signbox-list-pusher-tg-bot/main/scripts/remove.sh | bash
```

Скрипт дважды запросит подтверждение и **не затрагивает** другие Docker-контейнеры и образы на сервере.

### Ручной деплой

Если предпочитаете без скриптов:

1. Клонируйте репозиторий на сервер:

```bash
git clone https://github.com/bpGusar/signbox-list-pusher-tg-bot.git
cd signbox-list-pusher-tg-bot
```

Для приватного репозитория используйте SSH-ключ или deploy token.

2. Создайте и заполните `.env`:

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

3. Соберите образ и запустите контейнер в фоне:

```bash
docker compose --profile prod up -d --build
```

4. Проверьте, что контейнер работает:

```bash
docker compose --profile prod ps
docker compose --profile prod logs -f bot
```

Обновление вручную:

```bash
cd ~/signbox-list-pusher-tg-bot
git pull
docker compose --profile prod up -d --build
```

Если изменился только `.env`, достаточно пересоздать контейнер:

```bash
docker compose --profile prod up -d
```

### Эксплуатация


| Команда                                     | Описание                        |
| ------------------------------------------- | ------------------------------- |
| `docker compose --profile prod logs -f bot` | Логи в реальном времени         |
| `docker compose --profile prod restart bot` | Перезапуск без пересборки       |
| `docker compose --profile prod down`        | Остановка и удаление контейнера |
| `docker compose --profile prod ps`          | Статус контейнера               |


### Безопасность

- Не коммитьте `.env` в git.
- Ограничьте права GitHub token только нужным репозиторием.
- Храните `.env` с правами `600` — только владелец может читать секреты.

