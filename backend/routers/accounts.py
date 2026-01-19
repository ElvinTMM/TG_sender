"""
Telegram accounts routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import json
import pandas as pd
from io import BytesIO

from config import db
from models.schemas import TelegramAccountCreate, TelegramAccountResponse
from services.auth_service import get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])


def get_price_category(value_usdt: float) -> str:
    if value_usdt < 300:
        return "low"
    elif value_usdt < 500:
        return "medium"
    return "high"


@router.get("", response_model=List[TelegramAccountResponse])
async def get_accounts(
    price_category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    
    if price_category == "low":
        query["value_usdt"] = {"$lt": 300}
    elif price_category == "medium":
        query["value_usdt"] = {"$gte": 300, "$lt": 500}
    elif price_category == "high":
        query["value_usdt"] = {"$gte": 500}
    
    accounts = await db.telegram_accounts.find(query, {"_id": 0}).to_list(1000)
    
    for acc in accounts:
        value = acc.get("value_usdt", 0)
        acc["price_category"] = get_price_category(value)
    
    return [TelegramAccountResponse(**acc) for acc in accounts]


@router.get("/stats")
async def get_accounts_stats(current_user: dict = Depends(get_current_user)):
    """Get account counts by price category"""
    user_id = current_user["id"]
    
    low_count = await db.telegram_accounts.count_documents({
        "user_id": user_id,
        "$or": [{"value_usdt": {"$lt": 300}}, {"value_usdt": {"$exists": False}}]
    })
    medium_count = await db.telegram_accounts.count_documents({
        "user_id": user_id,
        "value_usdt": {"$gte": 300, "$lt": 500}
    })
    high_count = await db.telegram_accounts.count_documents({
        "user_id": user_id,
        "value_usdt": {"$gte": 500}
    })
    total = await db.telegram_accounts.count_documents({"user_id": user_id})
    
    return {
        "total": total,
        "low": low_count,
        "medium": medium_count,
        "high": high_count
    }


@router.post("", response_model=TelegramAccountResponse)
async def create_account(account: TelegramAccountCreate, current_user: dict = Depends(get_current_user)):
    account_id = str(uuid.uuid4())
    
    proxy_data = account.proxy.model_dump() if account.proxy else {"enabled": False, "type": "socks5", "host": "", "port": 0}
    limits_data = account.limits.model_dump() if account.limits else {"max_per_hour": 20, "max_per_day": 100, "delay_min": 30, "delay_max": 90}
    
    value_usdt = account.value_usdt or 0
    price_category = get_price_category(value_usdt)
    
    account_doc = {
        "id": account_id,
        "user_id": current_user["id"],
        "phone": account.phone,
        "name": account.name or account.phone,
        "api_id": account.api_id,
        "api_hash": account.api_hash,
        "session_string": account.session_string,
        "proxy": proxy_data,
        "limits": limits_data,
        "value_usdt": value_usdt,
        "price_category": price_category,
        "status": "pending",
        "messages_sent_today": 0,
        "messages_sent_hour": 0,
        "total_messages_sent": 0,
        "total_messages_delivered": 0,
        "last_hour_reset": datetime.now(timezone.utc).isoformat(),
        "last_day_reset": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_active": None
    }
    await db.telegram_accounts.insert_one(account_doc)
    return TelegramAccountResponse(**{k: v for k, v in account_doc.items() if k not in ["user_id", "api_id", "api_hash", "session_string"]})


@router.put("/{account_id}", response_model=TelegramAccountResponse)
async def update_account(account_id: str, account: TelegramAccountCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.telegram_accounts.find_one({"id": account_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    
    value_usdt = account.value_usdt or existing.get("value_usdt", 0)
    
    update_data = {
        "phone": account.phone,
        "name": account.name or account.phone,
        "value_usdt": value_usdt,
        "price_category": get_price_category(value_usdt)
    }
    
    if account.api_id:
        update_data["api_id"] = account.api_id
    if account.api_hash:
        update_data["api_hash"] = account.api_hash
    if account.session_string:
        update_data["session_string"] = account.session_string
    if account.proxy:
        update_data["proxy"] = account.proxy.model_dump()
    if account.limits:
        update_data["limits"] = account.limits.model_dump()
    
    await db.telegram_accounts.update_one({"id": account_id}, {"$set": update_data})
    
    updated = await db.telegram_accounts.find_one({"id": account_id}, {"_id": 0})
    updated["price_category"] = get_price_category(updated.get("value_usdt", 0))
    return TelegramAccountResponse(**{k: v for k, v in updated.items() if k not in ["user_id", "api_id", "api_hash", "session_string"]})


@router.post("/import")
async def import_accounts(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    content = await file.read()
    accounts = []
    
    if file.filename.endswith('.json'):
        data = json.loads(content.decode('utf-8'))
        accounts = data if isinstance(data, list) else [data]
    elif file.filename.endswith('.csv'):
        df = pd.read_csv(BytesIO(content))
        accounts = df.to_dict('records')
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use JSON or CSV")
    
    imported = 0
    for acc in accounts:
        account_id = str(uuid.uuid4())
        phone = str(acc.get('phone', '')).strip()
        if not phone:
            continue
        
        existing = await db.telegram_accounts.find_one({"phone": phone, "user_id": current_user["id"]})
        if existing:
            continue
        
        value_usdt = float(acc.get('value_usdt', 0)) if acc.get('value_usdt') else 0
        
        proxy_data = {
            "enabled": bool(acc.get('proxy_host')),
            "type": acc.get('proxy_type', 'socks5'),
            "host": acc.get('proxy_host', ''),
            "port": int(acc.get('proxy_port', 0)) if acc.get('proxy_port') else 0,
            "username": acc.get('proxy_username'),
            "password": acc.get('proxy_password')
        }
        
        limits_data = {
            "max_per_hour": int(acc.get('max_per_hour', 20)),
            "max_per_day": int(acc.get('max_per_day', 100)),
            "delay_min": int(acc.get('delay_min', 30)),
            "delay_max": int(acc.get('delay_max', 90))
        }
        
        account_doc = {
            "id": account_id,
            "user_id": current_user["id"],
            "phone": phone,
            "name": acc.get('name', phone),
            "api_id": acc.get('api_id'),
            "api_hash": acc.get('api_hash'),
            "session_string": acc.get('session_string'),
            "proxy": proxy_data,
            "limits": limits_data,
            "value_usdt": value_usdt,
            "price_category": get_price_category(value_usdt),
            "status": "active",
            "messages_sent_today": 0,
            "messages_sent_hour": 0,
            "total_messages_sent": 0,
            "total_messages_delivered": 0,
            "last_hour_reset": datetime.now(timezone.utc).isoformat(),
            "last_day_reset": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active": None
        }
        await db.telegram_accounts.insert_one(account_doc)
        imported += 1
    
    return {"message": f"Successfully imported {imported} accounts", "imported": imported}


@router.put("/{account_id}/status")
async def update_account_status(account_id: str, status: str, current_user: dict = Depends(get_current_user)):
    if status not in ["active", "banned", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.telegram_accounts.update_one(
        {"id": account_id, "user_id": current_user["id"]},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Status updated"}


@router.delete("/{account_id}")
async def delete_account(account_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.telegram_accounts.delete_one({"id": account_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account deleted"}
