ARCHIVE.EXE final23 — DataCat authenticated lookup

Что изменено:
- DataCat lookup теперь отправляет Cloudflare secrets:
  DATACAT_DEVICE_TOKEN -> x-device-token
  DATACAT_SESSION_TOKEN -> x-session-token
- /api/health показывает datacatSecrets: true/false (без раскрытия значений).
- 401/403 теперь возвращаются как DATACAT_SESSION_ERROR.
- Если DataCat знает персонажа: IMPORTED_FROM_DATACAT + сохранение в D1.
- Если DataCat не знает персонажа: NEEDS_DATACAT_RETRIEVAL.

Установка:
Загрузить папку src поверх текущей папки src в GitHub.
Другие файлы проекта менять не требуется.
