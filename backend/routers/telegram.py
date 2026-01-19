"""
Telegram authorization and messaging routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from config import db
from services.auth_service import get_current_user
from services.telegram_service import (
    start_authorization,
    verify_code,
    verify_2fa,
    send_message,
    send_voice_message,
    check_account_status
)

router = APIRouter(prefix="/telegram", tags=["telegram"])


class AuthStartRequest(BaseModel):
    account_id: str


class CodeVerifyRequest(BaseModel):
    account_id: str
    code: str


class TwoFARequest(BaseModel):
    account_id: str
    password: str


class SendMessageRequest(BaseModel):
    account_id: str
    recipient_phone: str
    message: str


class SendVoiceRequest(BaseModel):
    account_id: str
    recipient_phone: str
    voice_message_id: str


@router.post("/auth/start")
async def start_auth(request: AuthStartRequest, current_user: dict = Depends(get_current_user)):
    """Start authorization for a Telegram account (sends SMS code)"""
    account = await db.telegram_accounts.find_one({
        "id": request.account_id,
        "user_id": current_user["id"]
    })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    result = await start_authorization(
        account_id=request.account_id,
        phone=account["phone"],
        proxy=account.get("proxy")
    )
    
    return result


@router.post("/auth/verify-code")
async def verify_auth_code(request: CodeVerifyRequest, current_user: dict = Depends(get_current_user)):
    """Verify SMS code for authorization"""
    account = await db.telegram_accounts.find_one({
        "id": request.account_id,
        "user_id": current_user["id"]
    })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    phone_code_hash = account.get("phone_code_hash")
    if not phone_code_hash:
        raise HTTPException(status_code=400, detail="No pending authorization. Start auth first")
    
    result = await verify_code(
        account_id=request.account_id,
        phone=account["phone"],
        code=request.code,
        phone_code_hash=phone_code_hash,
        proxy=account.get("proxy")
    )
    
    return result


@router.post("/auth/verify-2fa")
async def verify_2fa_password(request: TwoFARequest, current_user: dict = Depends(get_current_user)):
    """Verify 2FA password"""
    account = await db.telegram_accounts.find_one({
        "id": request.account_id,
        "user_id": current_user["id"]
    })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    result = await verify_2fa(
        account_id=request.account_id,
        phone=account["phone"],
        password=request.password,
        proxy=account.get("proxy")
    )
    
    return result


@router.post("/send")
async def send_telegram_message(request: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    """Send a text message via Telegram"""
    account = await db.telegram_accounts.find_one({
        "id": request.account_id,
        "user_id": current_user["id"]
    })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.get("status") != "active":
        raise HTTPException(status_code=400, detail=f"Account is not active. Status: {account.get('status')}")
    
    if not account.get("session_string"):
        raise HTTPException(status_code=400, detail="Account not authorized")
    
    result = await send_message(
        account_id=request.account_id,
        phone=account["phone"],
        session_string=account["session_string"],
        recipient_phone=request.recipient_phone,
        message=request.message,
        proxy=account.get("proxy")
    )
    
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.post("/send-voice")
async def send_telegram_voice(request: SendVoiceRequest, current_user: dict = Depends(get_current_user)):
    """Send a voice message via Telegram"""
    from config import UPLOAD_DIR
    
    account = await db.telegram_accounts.find_one({
        "id": request.account_id,
        "user_id": current_user["id"]
    })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.get("status") != "active":
        raise HTTPException(status_code=400, detail=f"Account is not active")
    
    voice = await db.voice_messages.find_one({
        "id": request.voice_message_id,
        "user_id": current_user["id"]
    })
    
    if not voice:
        raise HTTPException(status_code=404, detail="Voice message not found")
    
    voice_file_path = str(UPLOAD_DIR / voice["filename"])
    
    result = await send_voice_message(
        account_id=request.account_id,
        phone=account["phone"],
        session_string=account["session_string"],
        recipient_phone=request.recipient_phone,
        voice_file_path=voice_file_path,
        proxy=account.get("proxy")
    )
    
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.get("/account/{account_id}/status")
async def get_telegram_account_status(account_id: str, current_user: dict = Depends(get_current_user)):
    """Check Telegram account authorization status"""
    account = await db.telegram_accounts.find_one({
        "id": account_id,
        "user_id": current_user["id"]
    })
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if not account.get("session_string"):
        return {"status": "not_authorized", "message": "No session. Authorization required"}
    
    result = await check_account_status(
        account_id=account_id,
        phone=account["phone"],
        session_string=account["session_string"],
        proxy=account.get("proxy")
    )
    
    # Update DB status if changed
    if result["status"] in ["banned", "session_expired"]:
        await db.telegram_accounts.update_one(
            {"id": account_id},
            {"$set": {"status": result["status"]}}
        )
    
    return result
