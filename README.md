# ARCHIVE.EXE

Публичный архив AI-персонажей (CHARACTERS) и ресурсов для ролевых AI (TAVO HUB).
Продакшен: https://archive-exe.node-00.workers.dev · проверка задеплоенной версии: `/api/build-info`.

## Как устроено

- **Cloudflare Worker** (`wrangler.toml`, вход — `src/cloudflare-entry-v2.js`) отдаёт сайт и API.
- **`public/`** — всё, что видит посетитель и админка (HTML/CSS/JS). Других копий сайта в репозитории нет.
- **D1** (`archive-characters`) — база: персонажи, лорбуки, ресурсы хаба, черновики, курация вселенных.
- **R2** (`archive-exe-hub-files`) — файлы и картинки ресурсов хаба.
- **Cloudflare Access** закрывает `/admin/*` и `/api/admin/*`; Worker дополнительно проверяет JWT Access (`src/admin-auth.js`).
- **Telegram-боты:** админский (`/telegram/admin`) собирает черновики ресурсов из пересланных постов, публичный (`/telegram/public`) — архив внутри Telegram.

## Страница каталога: кто за что отвечает

`public/characters.html` подключает слои по порядку; каждый следующий опирается на предыдущие. Прежде чем править поведение, найдите слой-владельца — иначе правка перекроется.

| Файл | Отвечает за |
|---|---|
| `app.js` | Основа: фильтры, поиск, сортировка, сетка карточек, карточка бота (`openModal` → `renderModalHead` / `renderModalPanel`), эффекты шапки, пасхалки |
| `catalog-api.js` | Загрузка `/api/catalog`, нормализация данных, догружает `ui-fixes.js` и `lorebooks.js` |
| `character-import.js` | Кнопка «+ IMPORT» для всех: ссылка JanitorAI → `/api/import` (ожидание DataCat) → бот сразу в каталоге, открывается его карточка. Уже добавленный бот не перезаписывается, скрытый админом — не возвращается |
| `png-download.js` | Скачивание карточки PNG/JSON |
| `source-label-fix.js` | Обёртка `render`: строки сеттингов, вселенных и тегов на карточках и в модалке |
| `lorebook-picker.js` / `lorebooks.js` | Выбор и скачивание лорбуков; вкладки лорбуков и хэштегов в каталоге |
| `ui-fixes.js` | Открытие карточки по событию `archive:open-character` (например, из импорта) |
| `fonts/fonts.css` | Шрифты сайта («Заросший архив»), лежат на самом сайте (CSP не пускает Google Fonts). Роли: `--font-title` Cormorant Garamond — заголовки, `--font-mono` IBM Plex Mono — подписи и кнопки, `--font-text` IBM Plex Sans — текст для чтения. Лицензия OFL в `fonts/OFL.txt` |
| `character-modal.css` | Вид карточки бота: одна колонка текста, вкладки About / Intros / Scenario / Creator notes. Текст делится на сервере в `src/description-sections.js` |
| `uiux-audit-patch.js` | Мобильные правки интерфейса, подключает `cross-nav.js` |

Стили: `styles.css` → `mobile-quiet.css` → `catalog-checkpoint.css` → `uiux-audit-patch.css` (поздний файл перекрывает ранний). Для безопасной чистки CSS/JS — `scripts/dev/`.

## Выкладка

Push в `main` → GitHub Actions (`deploy-worker`): `npm run check` → миграции D1 → `wrangler deploy` → смоук-тест продакшена.
Нужны секреты репозитория `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID`.
При каждом релизе меняйте `BUILD_INFO.build` в `src/cloudflare-entry-v2.js`, чтобы по `/api/build-info` было видно, что версия обновилась.

## Проверки

- `npm run check` — аудиты кода, поведенческие тесты (`scripts/test-*.mjs`, часть работает на SQLite в памяти, собранном из `migrations/`), синтаксис JS, пробная сборка Worker.
- `npm run check:production` — смоук-тест живого сайта.

## Схема базы

Только через пронумерованные миграции в `migrations/` (`npm run db:migrate:local` / применяются автоматически при деплое). Во время работы Worker схему не меняет.
