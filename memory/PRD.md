# TG Sender - Telegram Mass Messaging Platform

## Original Problem Statement
Создать бота в Telegram для массовой рассылки холодным клиентам. К боту подключаются множество аккаунтов, загружается база номеров, ведется аналитика.

## User Choices
- Рассылка через Telegram API (Telethon/Pyrogram)
- Полная аналитика: отправленные/доставленные, статусы аккаунтов, конверсия ответов
- Массовый импорт аккаунтов из JSON/CSV
- База номеров: CSV и Excel
- JWT авторизация

## Architecture
- **Backend**: FastAPI + MongoDB + JWT Auth
- **Frontend**: React + Tailwind + Shadcn UI + Recharts
- **Database**: MongoDB (users, telegram_accounts, contacts, campaigns, messages)

## What's Been Implemented (January 2025)
- ✅ JWT Authentication (Register/Login)
- ✅ Dashboard with real-time analytics
- ✅ Telegram Accounts Management (CRUD, import JSON/CSV)
- ✅ Contacts Management (CRUD, import JSON/CSV/Excel, tags, filtering)
- ✅ Campaigns Management (create, start, pause, delete)
- ✅ Analytics Page (charts, rates, pie charts)
- ✅ Dark theme "Cyber Command Center" design
- ✅ Russian language interface

## MOCKED Features
- ⚠️ Actual Telegram message sending is SIMULATED (requires Telethon session)
- Campaign start simulates 90% delivery rate to first 50 contacts

## P0 Features (Critical)
- ✅ All implemented

## P1 Features (High Priority)
- [ ] Real Telethon/Pyrogram integration for actual message sending
- [ ] Account authentication via QR code or phone code
- [ ] Message scheduling
- [ ] Response tracking (webhook for incoming messages)

## P2 Features (Medium Priority)
- [ ] Message templates with variables
- [ ] A/B testing for messages
- [ ] Export analytics to CSV
- [ ] Account health monitoring
- [ ] Rate limiting per account

## Backlog
- Webhook for Telegram responses
- Message queue with delays
- Account rotation strategies
- Blacklist management
- Multi-language templates
