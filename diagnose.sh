#!/bin/bash
# Скрипт диагностики локальной установки TG Sender

echo "=== 1. Проверка MongoDB ==="
if command -v mongosh &> /dev/null; then
    mongosh --eval "db.adminCommand('ping')" 2>/dev/null && echo "MongoDB работает" || echo "MongoDB НЕ ОТВЕЧАЕТ"
else
    echo "mongosh не найден, пробуем mongo..."
    mongo --eval "db.adminCommand('ping')" 2>/dev/null && echo "MongoDB работает" || echo "MongoDB НЕ ОТВЕЧАЕТ"
fi

echo ""
echo "=== 2. Проверка .env файла ==="
if [ -f "backend/.env" ]; then
    cat backend/.env
else
    echo "ОШИБКА: backend/.env не найден!"
fi

echo ""
echo "=== 3. Проверка зависимостей Python ==="
cd backend
pip list | grep -E "(fastapi|motor|telethon|pydantic)"

echo ""
echo "=== 4. Тест API ==="
# Измените URL если нужно
API_URL="http://localhost:8001"

echo "Health check:"
curl -s "$API_URL/api/health" && echo "" || echo "ОШИБКА: Backend не отвечает"

echo ""
echo "=== 5. Тест создания аккаунта ==="
# Сначала регистрация
RESULT=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"local_test@test.com","password":"Test123!","name":"Local Test"}')
echo "Register result: $RESULT"

# Логин
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"local_test@test.com","password":"Test123!"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','ОШИБКА'))")
echo "Token: ${TOKEN:0:30}..."

if [ "$TOKEN" != "ОШИБКА" ]; then
  # Создание аккаунта
  echo "Creating account..."
  curl -s -X POST "$API_URL/api/accounts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"phone":"+79991111111","name":"Test"}' | python3 -m json.tool
fi

echo ""
echo "=== Диагностика завершена ==="
