# TG Sender - Telegram Bot Manager

## Оригинальная задача
Веб-панель для управления массовыми рассылками в Telegram с поддержкой 50+ аккаунтов, прокси, аналитикой.

## Технический стек
- **Backend**: FastAPI + MongoDB + Telethon
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Auth**: JWT

---

## ✅ Что реализовано (19 января 2026)

### Интеграция Telethon (НОВОЕ!)
**Файлы:**
- `/backend/services/telegram_service.py` - сервис Telethon
- `/backend/routers/telegram.py` - API endpoints

**API Endpoints:**
- `POST /api/telegram/auth/start` - начать авторизацию (отправить SMS)
- `POST /api/telegram/auth/verify-code` - проверить SMS код
- `POST /api/telegram/auth/verify-2fa` - проверить 2FA пароль
- `POST /api/telegram/send` - отправить сообщение
- `POST /api/telegram/send-voice` - отправить голосовое
- `GET /api/telegram/account/{id}/status` - проверить статус

**Функционал:**
- Авторизация по номеру телефона (SMS + 2FA)
- Поддержка прокси (SOCKS5/SOCKS4/HTTP)
- Хранение session_string в MongoDB
- Кэширование активных подключений
- UI диалог авторизации на странице аккаунтов

**Конфигурация (.env):**
```
TELEGRAM_API_ID="39422475"
TELEGRAM_API_HASH="1928c5d1c5626e98e04a21fe2b7072d0"
```

### Рефакторинг backend (v2.0)
Модульная структура:
- `/routers/` - 10 модулей
- `/models/schemas.py` - Pydantic
- `/services/` - бизнес-логика

### Ротация и лимиты
- Умный выбор аккаунта
- Соблюдение лимитов
- Отчёт `by_category`

### Follow-up
- API очереди
- Ручная обработка

---

## ⚠️ Текущий статус

**Готово к использованию:**
- ✅ UI авторизации аккаунтов
- ✅ API для отправки сообщений
- ✅ Поддержка 2FA

**Требует тестирования с реальным аккаунтом:**
- Авторизация через SMS
- Отправка сообщений
- Голосовые сообщения

---

## Тестирование
- **Backend**: 34/34 тестов пройдено (без Telethon - симуляция)
- **Telethon**: требует ручного тестирования с реальным аккаунтом

---

## Структура файлов
```
/app/backend/
├── main.py
├── config.py
├── routers/
│   ├── telegram.py      # НОВОЕ
│   └── ... (9 других)
├── services/
│   ├── telegram_service.py  # НОВОЕ
│   └── ... (3 других)
├── sessions/            # Telethon sessions
└── .env
```

---

## Как авторизовать аккаунт

1. Добавьте аккаунт (кнопка "Добавить")
2. Введите номер телефона
3. Нажмите меню (...) → "Авторизовать в Telegram"
4. Введите SMS код
5. Если включена 2FA - введите пароль
6. Аккаунт станет "Активен"

---

## Предстоящие задачи

### P1 - Важно
1. **Тестирование с реальным аккаунтом**
2. **Интеграция Telethon в campaign_service** для реальной отправки

### P2 - Улучшения
3. **WebSocket для диалогов**
4. **Автоматическая обработка входящих**
