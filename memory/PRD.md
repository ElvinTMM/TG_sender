# TG Sender - Telegram Bot Manager

## Оригинальная задача
Создать веб-панель для управления массовыми рассылками в Telegram с подключением большого количества аккаунтов. Панель должна поддерживать загрузку базы номеров и предоставлять аналитику.

## Основные требования
1. **Управление аккаунтами**: Подключение 50+ Telegram аккаунтов с прокси
2. **Категории по стоимости**: Группировка аккаунтов по цене (<300$, 300-500$, 500$+)
3. **Контакты**: Загрузка и управление базой контактов
4. **Кампании**: Создание рассылок с выбором категорий аккаунтов
5. **Шаблоны**: Шаблоны сообщений с переменными и спинтаксом
6. **Аналитика**: Статистика по отправкам и ответам
7. **Голосовые**: Отправка голосовых сообщений тем, кто прочитал но не ответил
8. **Диалоги**: Просмотр переписок с клиентами

## Технический стек
- **Backend**: FastAPI + MongoDB + Motor
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Auth**: JWT (python-jose, passlib)

## Что реализовано

### ✅ Завершено (19 января 2026)

**Инфраструктура:**
- JWT авторизация (регистрация, вход, /api/auth/me)
- Полная структура API endpoints
- MongoDB интеграция

**Управление аккаунтами:**
- CRUD операции для Telegram аккаунтов
- Поле `value_usdt` для стоимости аккаунта
- Автоматическая категоризация: low (<300$), medium (300-500$), high (500$+)
- Вкладки на странице аккаунтов по категориям
- Настройка прокси (SOCKS5/SOCKS4/HTTP)
- Лимиты отправки (в час/день, задержки)

**Кампании:**
- Создание кампаний с выбором категорий аккаунтов
- Два режима: "По категориям" или "Выбрать вручную"
- Кнопка "Выбрать все" для быстрого выбора
- Привязка к шаблонам сообщений
- Фильтр по тегам контактов
- Опции ротации и учёта лимитов

**Шаблоны:**
- CRUD для шаблонов сообщений
- Переменные: {name}, {time}, {phone}
- Спинтакс: {вариант1|вариант2}

**Контакты:**
- CRUD операции
- Импорт из CSV/JSON/Excel
- Теги для группировки
- Статусы: pending, messaged, responded, read

**Аналитика:**
- Общая статистика (аккаунты, контакты, сообщения)
- Показатели доставляемости и ответов
- График активности за 7 дней
- Распределение по категориям аккаунтов

**Голосовые сообщения (UI готов):**
- Загрузка аудио файлов
- Настройка задержки отправки
- Очередь follow-up

**Диалоги (UI готов):**
- Просмотр переписок
- Ответы на сообщения

## ⚠️ ВАЖНО: Симуляция
**ВСЯ функциональность Telegram СИМУЛИРОВАНА:**
- Сообщения НЕ отправляются реально
- Статусы доставки генерируются случайно (90% success)
- Ответы симулируются (5-15%)
- Требуется интеграция с Telethon

## Тестирование
- **Backend**: 30/30 тестов пройдено (100%)
- **Frontend**: UI протестирован
- **Файл тестов**: `/app/tests/test_telegram_bot_manager.py`

## API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Accounts
- GET /api/accounts (с фильтром по price_category)
- GET /api/accounts/stats
- POST /api/accounts
- PUT /api/accounts/{id}
- DELETE /api/accounts/{id}

### Campaigns
- GET /api/campaigns
- POST /api/campaigns (с account_categories)
- PUT /api/campaigns/{id}/start
- DELETE /api/campaigns/{id}

### Templates
- GET/POST/PUT/DELETE /api/templates

### Analytics
- GET /api/analytics

### Contacts
- GET/POST/DELETE /api/contacts
- POST /api/contacts/import

### Voice Messages
- GET/POST/DELETE /api/voice-messages

### Dialogs
- GET /api/dialogs
- POST /api/dialogs/{id}/reply

## Предстоящие задачи (P0-P2)

### P0 - Критично
1. **Интеграция с Telegram (Telethon)**
   - Авторизация аккаунтов (api_id, api_hash, SMS/2FA)
   - Реальная отправка сообщений
   - Отслеживание статусов (sent, delivered, read)

### P1 - Важно
2. **Голосовые сообщения**
   - Отправка аудио через Telethon
   - Логика "прочитал но не ответил"

3. **Диалоги в реальном времени**
   - WebSocket для получения входящих
   - Real-time обновления

### P2 - Улучшения
4. **Ротация и лимиты**
   - Реальное ограничение отправок
   - Умная ротация аккаунтов

5. **Рефакторинг backend**
   - Разбить server.py на модули
   - /routers, /models, /services

## Файлы проекта

```
/app/
├── backend/
│   ├── server.py          # Все API (монолит)
│   ├── requirements.txt
│   ├── .env
│   └── uploads/voice/     # Голосовые сообщения
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── AccountsPage.jsx
│       │   ├── CampaignsPage.jsx   # С выбором категорий
│       │   ├── ContactsPage.jsx
│       │   ├── TemplatesPage.jsx
│       │   ├── AnalyticsPage.jsx
│       │   ├── VoicePage.jsx
│       │   └── DialogsPage.jsx
│       └── components/
│           └── DashboardLayout.jsx
└── tests/
    └── test_telegram_bot_manager.py
```

## Требования для интеграции с Telegram
Для реальной работы потребуется:
1. `api_id` и `api_hash` от https://my.telegram.org
2. Установка Telethon: `pip install telethon`
3. Обработка авторизации (SMS код, 2FA)
4. Хранение session файлов
