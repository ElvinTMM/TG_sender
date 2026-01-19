# TG Sender - Telegram Bot Manager

## Оригинальная задача
Создать веб-панель для управления массовыми рассылками в Telegram с подключением большого количества аккаунтов. Панель должна поддерживать загрузку базы номеров и предоставлять аналитику.

## Технический стек
- **Backend**: FastAPI + MongoDB + Motor
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Auth**: JWT (python-jose, passlib)

---

## ✅ Что реализовано (19 января 2026)

### Рефакторинг backend (v2.0)
Монолитный `server.py` (~1300 строк) разбит на модули:
```
/app/backend/
├── main.py              # FastAPI app, роутеры
├── config.py            # Настройки, MongoDB
├── routers/
│   ├── auth.py          # Регистрация, вход
│   ├── accounts.py      # Telegram аккаунты
│   ├── campaigns.py     # Кампании рассылок
│   ├── contacts.py      # База контактов
│   ├── templates.py     # Шаблоны сообщений
│   ├── analytics.py     # Статистика
│   ├── dialogs.py       # Переписки
│   ├── voice.py         # Голосовые сообщения
│   └── followup.py      # Follow-up очередь
├── models/
│   └── schemas.py       # Pydantic модели
├── services/
│   ├── auth_service.py      # JWT, хеширование
│   ├── campaign_service.py  # Логика рассылок с ротацией
│   └── followup_service.py  # Логика follow-up
└── server.py            # Обратная совместимость
```

### Ротация аккаунтов и лимиты
- **Умный выбор аккаунта**: выбирается наименее нагруженный
- **Лимиты**: max сообщений в час/день на аккаунт
- **Автосброс счётчиков**: hourly и daily reset
- **Пропуск перегруженных**: если лимит достигнут, переход к другому аккаунту
- **Распределение по категориям**: отчёт `by_category` в результате кампании

### Логика "прочитал, но не ответил"
- **Статус `read`**: контакты отмечаются при симуляции
- **Очередь follow-up**: добавление read-контактов в очередь
- **Ручная обработка**: кнопка "Отправить сейчас"
- **Статистика**: pending, sent, failed, cancelled
- **API endpoints**:
  - GET `/api/followup-queue/stats`
  - POST `/api/followup-queue/add-read-contacts`
  - POST `/api/followup-queue/process`

### Основной функционал (из предыдущих версий)
- JWT авторизация
- Аккаунты с категориями по стоимости (<300$, 300-500$, 500$+)
- Выбор категорий при создании кампании
- Шаблоны с переменными и спинтаксом
- Импорт контактов (CSV, JSON, Excel)
- Аналитика с графиками

---

## ⚠️ ВАЖНО: Симуляция
**ВСЯ функциональность Telegram СИМУЛИРОВАНА:**
- Сообщения НЕ отправляются реально
- Статусы доставки генерируются случайно (90% success)
- Ответы симулируются (5-15%)
- "Прочитал" симулируется (30-50%)
- Требуется интеграция с Telethon

---

## Тестирование
- **Backend**: 34/34 тестов пройдено (100%)
- **Файл тестов**: `/app/tests/test_telegram_bot_manager.py`

---

## API Endpoints (v2.0)

### Auth
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`

### Accounts
- GET `/api/accounts` (?price_category=low|medium|high)
- GET `/api/accounts/stats`
- POST `/api/accounts`
- PUT `/api/accounts/{id}`
- PUT `/api/accounts/{id}/status`
- DELETE `/api/accounts/{id}`

### Campaigns
- GET `/api/campaigns`
- POST `/api/campaigns` (account_categories, use_rotation, respect_limits)
- PUT `/api/campaigns/{id}/start` → returns by_category, skipped_due_to_limits
- DELETE `/api/campaigns/{id}`

### Follow-up
- GET `/api/followup-queue`
- GET `/api/followup-queue/stats`
- POST `/api/followup-queue/add-read-contacts`
- POST `/api/followup-queue/process`
- DELETE `/api/followup-queue/{id}`
- DELETE `/api/followup-queue`

### Templates, Contacts, Voice, Dialogs, Analytics
- См. соответствующие роутеры

---

## Предстоящие задачи

### P0 - Критично
1. **Интеграция с Telegram (Telethon)**
   - Авторизация аккаунтов (api_id, api_hash, SMS/2FA)
   - Реальная отправка сообщений
   - Получение статусов (sent, delivered, read)
   - Получение входящих сообщений

### P1 - Важно
2. **Реальная отправка голосовых**
   - Через Telethon API

3. **WebSocket для диалогов**
   - Real-time входящие сообщения

### P2 - Улучшения
4. **A/B тестирование шаблонов**
5. **Расширенная аналитика по категориям**

---

## Требования для Telegram интеграции
1. `api_id` и `api_hash` от https://my.telegram.org
2. Установка: `pip install telethon`
3. Обработка авторизации (SMS, 2FA)
4. Хранение session файлов

---

## Структура файлов
```
/app/
├── backend/
│   ├── main.py, config.py, server.py
│   ├── routers/ (9 модулей)
│   ├── models/schemas.py
│   ├── services/ (3 сервиса)
│   └── uploads/voice/
├── frontend/
│   └── src/pages/ (9 страниц)
├── tests/
│   └── test_telegram_bot_manager.py (34 теста)
└── memory/
    └── PRD.md
```
