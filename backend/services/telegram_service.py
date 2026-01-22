"""
Telegram service using Telethon for real message sending
"""
import os
import asyncio
import logging
import random
import string
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pathlib import Path

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import (
    PhoneCodeInvalidError,
    PhoneCodeExpiredError,
    SessionPasswordNeededError,
    FloodWaitError,
    UserDeactivatedBanError,
    AuthKeyUnregisteredError
)
from telethon.tl.types import User, InputPeerUser

from config import db, ROOT_DIR

logger = logging.getLogger(__name__)

# Telegram API credentials from environment
API_ID = os.environ.get('TELEGRAM_API_ID', '39422475')
API_HASH = os.environ.get('TELEGRAM_API_HASH', '1928c5d1c5626e98e04a21fe2b7072d0')

# Session storage directory
SESSIONS_DIR = ROOT_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# Active client connections cache
_active_clients: Dict[str, TelegramClient] = {}

# Pending authorizations (before account is saved to DB)
_pending_auths: Dict[str, Dict[str, Any]] = {}


def generate_fingerprint() -> Dict[str, Any]:
    """Generate random device fingerprint for Telegram client"""
    
    # Device models
    android_devices = [
        "Samsung Galaxy S23 Ultra", "Samsung Galaxy S22", "Samsung Galaxy A54",
        "Samsung Galaxy Z Fold5", "Samsung Galaxy Z Flip5", "Samsung Galaxy Note 20",
        "Xiaomi 13 Pro", "Xiaomi 12T", "Xiaomi Redmi Note 12", "Xiaomi POCO F5",
        "OnePlus 11", "OnePlus 10 Pro", "OnePlus Nord 3",
        "Google Pixel 8 Pro", "Google Pixel 7a", "Google Pixel 6",
        "OPPO Find X6 Pro", "OPPO Reno 10", "Realme GT 3",
        "Huawei P60 Pro", "Huawei Mate 50", "Honor Magic 5",
        "Sony Xperia 1 V", "Motorola Edge 40", "Nothing Phone 2"
    ]
    
    iphone_devices = [
        "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
        "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
        "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini",
        "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12",
        "iPhone SE (3rd generation)", "iPhone 11 Pro Max", "iPhone 11"
    ]
    
    # System versions
    android_versions = [
        "Android 14", "Android 13", "Android 12", "Android 11", "Android 10"
    ]
    
    ios_versions = [
        "iOS 17.4", "iOS 17.3", "iOS 17.2", "iOS 17.1", "iOS 17.0",
        "iOS 16.7", "iOS 16.6", "iOS 16.5", "iOS 16.4"
    ]
    
    # App versions (Telegram versions)
    telegram_versions = [
        "10.8.1", "10.8.0", "10.7.2", "10.7.1", "10.7.0",
        "10.6.2", "10.6.1", "10.6.0", "10.5.2", "10.5.0",
        "10.4.2", "10.4.1", "10.4.0", "10.3.2", "10.3.1"
    ]
    
    # Languages
    languages = ["en", "ru", "de", "fr", "es", "it", "pt", "uk", "pl", "tr", "ar", "ja", "ko", "zh"]
    
    # Choose platform randomly
    is_ios = random.choice([True, False])
    
    if is_ios:
        device_model = random.choice(iphone_devices)
        system_version = random.choice(ios_versions)
    else:
        device_model = random.choice(android_devices)
        system_version = random.choice(android_versions)
    
    app_version = random.choice(telegram_versions)
    lang_code = random.choice(languages)
    system_lang_code = lang_code
    
    # Generate random SDK version for Android
    sdk_version = random.randint(28, 34) if not is_ios else None
    
    return {
        "device_model": device_model,
        "system_version": system_version,
        "app_version": app_version,
        "lang_code": lang_code,
        "system_lang_code": system_lang_code,
        "is_ios": is_ios,
        "sdk_version": sdk_version
    }


async def get_client(
    account_id: str, 
    phone: str, 
    session_string: str = None, 
    proxy: dict = None,
    fingerprint: dict = None
) -> TelegramClient:
    """Get or create a Telethon client for an account"""
    
    # Check cache first
    if account_id in _active_clients:
        client = _active_clients[account_id]
        if client.is_connected():
            return client
    
    # Create session
    if session_string:
        session = StringSession(session_string)
    else:
        session = StringSession()
    
    # Proxy configuration
    proxy_config = None
    if proxy and proxy.get('enabled'):
        proxy_type = proxy.get('type', 'socks5').lower()
        if proxy_type == 'socks5':
            import socks
            proxy_config = (socks.SOCKS5, proxy['host'], int(proxy['port']), True, 
                          proxy.get('username'), proxy.get('password'))
        elif proxy_type == 'socks4':
            import socks
            proxy_config = (socks.SOCKS4, proxy['host'], int(proxy['port']), True)
        elif proxy_type == 'http':
            import socks
            proxy_config = (socks.HTTP, proxy['host'], int(proxy['port']), True,
                          proxy.get('username'), proxy.get('password'))
    
    # Use fingerprint or generate new one
    fp = fingerprint or generate_fingerprint()
    
    # Create client with fingerprint
    client = TelegramClient(
        session,
        int(API_ID),
        API_HASH,
        proxy=proxy_config,
        device_model=fp.get("device_model", "Unknown Device"),
        system_version=fp.get("system_version", "Unknown"),
        app_version=fp.get("app_version", "10.0.0"),
        lang_code=fp.get("lang_code", "en"),
        system_lang_code=fp.get("system_lang_code", "en"),
        connection_retries=3,
        retry_delay=1,
        timeout=30
    )
    
    await client.connect()
    _active_clients[account_id] = client
    
    return client


async def start_authorization_new(
    phone: str, 
    proxy: dict = None,
    name: str = None,
    value_usdt: float = 0,
    limits: dict = None
) -> Dict[str, Any]:
    """Start phone authorization for NEW account - sends SMS code"""
    try:
        # Generate unique fingerprint for this account
        fingerprint = generate_fingerprint()
        
        # Create temporary ID for this auth session
        temp_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
        
        # Create client with fingerprint
        client = await get_client(temp_id, phone, proxy=proxy, fingerprint=fingerprint)
        
        if await client.is_user_authorized():
            # Already authorized (has session)
            me = await client.get_me()
            session_string = client.session.save()
            
            return {
                "status": "authorized",
                "message": "Account already authorized",
                "telegram_id": me.id,
                "username": me.username,
                "temp_id": temp_id,
                "session_string": session_string,
                "fingerprint": fingerprint
            }
        
        # Send code request
        result = await client.send_code_request(phone)
        
        # Store pending auth data
        _pending_auths[temp_id] = {
            "phone": phone,
            "phone_code_hash": result.phone_code_hash,
            "proxy": proxy,
            "name": name,
            "value_usdt": value_usdt,
            "limits": limits,
            "fingerprint": fingerprint,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        return {
            "status": "code_sent",
            "message": "SMS code sent to phone",
            "temp_id": temp_id,
            "phone_code_hash": result.phone_code_hash
        }
        
    except FloodWaitError as e:
        return {
            "status": "error",
            "message": f"Too many requests. Wait {e.seconds} seconds",
            "wait_seconds": e.seconds
        }
    except Exception as e:
        logger.error(f"Authorization start error: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


async def verify_code_new(
    temp_id: str, 
    code: str, 
    user_id: str
) -> Dict[str, Any]:
    """Verify SMS code for NEW account authorization"""
    try:
        # Get pending auth data
        pending = _pending_auths.get(temp_id)
        if not pending:
            return {"status": "error", "message": "Authorization session expired. Try again"}
        
        phone = pending["phone"]
        phone_code_hash = pending["phone_code_hash"]
        proxy = pending.get("proxy")
        fingerprint = pending.get("fingerprint")
        
        client = await get_client(temp_id, phone, proxy=proxy, fingerprint=fingerprint)
        
        try:
            # Sign in with code
            await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
            
        except SessionPasswordNeededError:
            # 2FA enabled
            return {
                "status": "2fa_required",
                "message": "Two-factor authentication required",
                "temp_id": temp_id
            }
        
        # Get user info
        me = await client.get_me()
        session_string = client.session.save()
        
        # Create account in database NOW (after successful auth)
        import uuid
        account_id = str(uuid.uuid4())
        
        def get_price_category(value: float) -> str:
            if value < 300:
                return "low"
            elif value < 500:
                return "medium"
            return "high"
        
        value_usdt = pending.get("value_usdt", 0)
        limits_data = pending.get("limits") or {
            "max_per_hour": 20, 
            "max_per_day": 100, 
            "delay_min": 30, 
            "delay_max": 90
        }
        proxy_data = proxy or {"enabled": False, "type": "socks5", "host": "", "port": 0}
        
        account_doc = {
            "id": account_id,
            "user_id": user_id,
            "phone": phone,
            "name": pending.get("name") or phone,
            "session_string": session_string,
            "proxy": proxy_data,
            "limits": limits_data,
            "value_usdt": value_usdt,
            "price_category": get_price_category(value_usdt),
            "fingerprint": fingerprint,  # Store fingerprint!
            "status": "active",
            "telegram_id": me.id,
            "telegram_username": me.username,
            "messages_sent_today": 0,
            "messages_sent_hour": 0,
            "total_messages_sent": 0,
            "total_messages_delivered": 0,
            "last_hour_reset": datetime.now(timezone.utc).isoformat(),
            "last_day_reset": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active": datetime.now(timezone.utc).isoformat()
        }
        
        await db.telegram_accounts.insert_one(account_doc)
        
        # Update client cache with real account_id
        if temp_id in _active_clients:
            _active_clients[account_id] = _active_clients.pop(temp_id)
        
        # Clean up pending auth
        del _pending_auths[temp_id]
        
        return {
            "status": "authorized",
            "message": "Successfully authorized",
            "account_id": account_id,
            "telegram_id": me.id,
            "username": me.username
        }
        
    except PhoneCodeInvalidError:
        return {"status": "error", "message": "Invalid code"}
    except PhoneCodeExpiredError:
        return {"status": "error", "message": "Code expired. Request new code"}
    except Exception as e:
        logger.error(f"Code verification error: {e}")
        return {"status": "error", "message": str(e)}


async def verify_2fa_new(
    temp_id: str, 
    password: str,
    user_id: str
) -> Dict[str, Any]:
    """Verify 2FA password for NEW account"""
    try:
        pending = _pending_auths.get(temp_id)
        if not pending:
            return {"status": "error", "message": "Authorization session expired"}
        
        phone = pending["phone"]
        proxy = pending.get("proxy")
        fingerprint = pending.get("fingerprint")
        
        client = await get_client(temp_id, phone, proxy=proxy, fingerprint=fingerprint)
        
        await client.sign_in(password=password)
        
        me = await client.get_me()
        session_string = client.session.save()
        
        # Create account in database
        import uuid
        account_id = str(uuid.uuid4())
        
        def get_price_category(value: float) -> str:
            if value < 300:
                return "low"
            elif value < 500:
                return "medium"
            return "high"
        
        value_usdt = pending.get("value_usdt", 0)
        limits_data = pending.get("limits") or {
            "max_per_hour": 20, 
            "max_per_day": 100, 
            "delay_min": 30, 
            "delay_max": 90
        }
        proxy_data = proxy or {"enabled": False, "type": "socks5", "host": "", "port": 0}
        
        account_doc = {
            "id": account_id,
            "user_id": user_id,
            "phone": phone,
            "name": pending.get("name") or phone,
            "session_string": session_string,
            "proxy": proxy_data,
            "limits": limits_data,
            "value_usdt": value_usdt,
            "price_category": get_price_category(value_usdt),
            "fingerprint": fingerprint,
            "status": "active",
            "telegram_id": me.id,
            "telegram_username": me.username,
            "messages_sent_today": 0,
            "messages_sent_hour": 0,
            "total_messages_sent": 0,
            "total_messages_delivered": 0,
            "last_hour_reset": datetime.now(timezone.utc).isoformat(),
            "last_day_reset": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active": datetime.now(timezone.utc).isoformat()
        }
        
        await db.telegram_accounts.insert_one(account_doc)
        
        # Update client cache
        if temp_id in _active_clients:
            _active_clients[account_id] = _active_clients.pop(temp_id)
        
        del _pending_auths[temp_id]
        
        return {
            "status": "authorized",
            "message": "Successfully authorized with 2FA",
            "account_id": account_id,
            "telegram_id": me.id,
            "username": me.username
        }
        
    except Exception as e:
        logger.error(f"2FA verification error: {e}")
        return {"status": "error", "message": str(e)}


# Keep old functions for existing accounts re-authorization
async def start_authorization(account_id: str, phone: str, proxy: dict = None) -> Dict[str, Any]:
    """Start phone authorization for EXISTING account - sends SMS code"""
    try:
        # Get existing fingerprint from DB or generate new
        account = await db.telegram_accounts.find_one({"id": account_id})
        fingerprint = account.get("fingerprint") if account else None
        
        if not fingerprint:
            fingerprint = generate_fingerprint()
            # Save fingerprint to account
            await db.telegram_accounts.update_one(
                {"id": account_id},
                {"$set": {"fingerprint": fingerprint}}
            )
        
        client = await get_client(account_id, phone, proxy=proxy, fingerprint=fingerprint)
        
        if await client.is_user_authorized():
            me = await client.get_me()
            session_string = client.session.save()
            
            await db.telegram_accounts.update_one(
                {"id": account_id},
                {"$set": {
                    "session_string": session_string,
                    "status": "active",
                    "telegram_id": me.id,
                    "telegram_username": me.username
                }}
            )
            
            return {
                "status": "authorized",
                "message": "Account already authorized",
                "telegram_id": me.id,
                "username": me.username
            }
        
        result = await client.send_code_request(phone)
        
        await db.telegram_accounts.update_one(
            {"id": account_id},
            {"$set": {
                "phone_code_hash": result.phone_code_hash,
                "auth_status": "awaiting_code"
            }}
        )
        
        return {
            "status": "code_sent",
            "message": "SMS code sent to phone",
            "phone_code_hash": result.phone_code_hash
        }
        
    except FloodWaitError as e:
        return {
            "status": "error",
            "message": f"Too many requests. Wait {e.seconds} seconds",
            "wait_seconds": e.seconds
        }
    except Exception as e:
        logger.error(f"Authorization start error: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


async def verify_code(account_id: str, phone: str, code: str, phone_code_hash: str, proxy: dict = None) -> Dict[str, Any]:
    """Verify SMS code for EXISTING account"""
    try:
        account = await db.telegram_accounts.find_one({"id": account_id})
        fingerprint = account.get("fingerprint") if account else None
        
        client = await get_client(account_id, phone, proxy=proxy, fingerprint=fingerprint)
        
        try:
            await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
        except SessionPasswordNeededError:
            return {
                "status": "2fa_required",
                "message": "Two-factor authentication required"
            }
        
        me = await client.get_me()
        session_string = client.session.save()
        
        await db.telegram_accounts.update_one(
            {"id": account_id},
            {"$set": {
                "session_string": session_string,
                "status": "active",
                "telegram_id": me.id,
                "telegram_username": me.username,
                "auth_status": "authorized"
            }}
        )
        
        return {
            "status": "authorized",
            "message": "Successfully authorized",
            "telegram_id": me.id,
            "username": me.username,
            "session_string": session_string
        }
        
    except PhoneCodeInvalidError:
        return {"status": "error", "message": "Invalid code"}
    except PhoneCodeExpiredError:
        return {"status": "error", "message": "Code expired. Request new code"}
    except Exception as e:
        logger.error(f"Code verification error: {e}")
        return {"status": "error", "message": str(e)}


async def verify_2fa(account_id: str, phone: str, password: str, proxy: dict = None) -> Dict[str, Any]:
    """Verify 2FA password for EXISTING account"""
    try:
        account = await db.telegram_accounts.find_one({"id": account_id})
        fingerprint = account.get("fingerprint") if account else None
        
        client = await get_client(account_id, phone, proxy=proxy, fingerprint=fingerprint)
        
        await client.sign_in(password=password)
        
        me = await client.get_me()
        session_string = client.session.save()
        
        await db.telegram_accounts.update_one(
            {"id": account_id},
            {"$set": {
                "session_string": session_string,
                "status": "active",
                "telegram_id": me.id,
                "telegram_username": me.username,
                "auth_status": "authorized"
            }}
        )
        
        return {
            "status": "authorized",
            "message": "Successfully authorized with 2FA",
            "telegram_id": me.id,
            "username": me.username
        }
        
    except Exception as e:
        logger.error(f"2FA verification error: {e}")
        return {"status": "error", "message": str(e)}


async def send_message(account_id: str, phone: str, session_string: str, 
                       recipient_phone: str, message: str, proxy: dict = None) -> Dict[str, Any]:
    """Send a text message to a contact"""
    try:
        account = await db.telegram_accounts.find_one({"id": account_id})
        fingerprint = account.get("fingerprint") if account else None
        
        client = await get_client(account_id, phone, session_string, proxy, fingerprint)
        
        if not await client.is_user_authorized():
            return {"status": "error", "message": "Account not authorized"}
        
        try:
            result = await client.get_entity(recipient_phone)
            sent_message = await client.send_message(result, message)
            
            return {
                "status": "sent",
                "message_id": sent_message.id,
                "date": sent_message.date.isoformat()
            }
            
        except ValueError:
            return {"status": "error", "message": "User not found on Telegram"}
            
    except UserDeactivatedBanError:
        await db.telegram_accounts.update_one(
            {"id": account_id},
            {"$set": {"status": "banned"}}
        )
        return {"status": "error", "message": "Account is banned"}
        
    except AuthKeyUnregisteredError:
        await db.telegram_accounts.update_one(
            {"id": account_id},
            {"$set": {"status": "session_expired", "session_string": None}}
        )
        return {"status": "error", "message": "Session expired. Re-authorization required"}
        
    except FloodWaitError as e:
        return {
            "status": "error", 
            "message": f"Flood wait: {e.seconds} seconds",
            "wait_seconds": e.seconds
        }
        
    except Exception as e:
        logger.error(f"Send message error: {e}")
        return {"status": "error", "message": str(e)}


async def send_voice_message(account_id: str, phone: str, session_string: str,
                             recipient_phone: str, voice_file_path: str, proxy: dict = None) -> Dict[str, Any]:
    """Send a voice message to a contact"""
    try:
        account = await db.telegram_accounts.find_one({"id": account_id})
        fingerprint = account.get("fingerprint") if account else None
        
        client = await get_client(account_id, phone, session_string, proxy, fingerprint)
        
        if not await client.is_user_authorized():
            return {"status": "error", "message": "Account not authorized"}
        
        try:
            result = await client.get_entity(recipient_phone)
            sent_message = await client.send_file(
                result,
                voice_file_path,
                voice_note=True
            )
            
            return {
                "status": "sent",
                "message_id": sent_message.id,
                "date": sent_message.date.isoformat()
            }
            
        except ValueError:
            return {"status": "error", "message": "User not found on Telegram"}
            
    except Exception as e:
        logger.error(f"Send voice error: {e}")
        return {"status": "error", "message": str(e)}


async def check_account_status(account_id: str, phone: str, session_string: str, proxy: dict = None) -> Dict[str, Any]:
    """Check if account is still active and authorized"""
    try:
        account = await db.telegram_accounts.find_one({"id": account_id})
        fingerprint = account.get("fingerprint") if account else None
        
        client = await get_client(account_id, phone, session_string, proxy, fingerprint)
        
        if await client.is_user_authorized():
            me = await client.get_me()
            return {
                "status": "active",
                "telegram_id": me.id,
                "username": me.username,
                "first_name": me.first_name
            }
        else:
            return {"status": "not_authorized"}
            
    except UserDeactivatedBanError:
        return {"status": "banned"}
    except AuthKeyUnregisteredError:
        return {"status": "session_expired"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def disconnect_client(account_id: str):
    """Disconnect a client from cache"""
    if account_id in _active_clients:
        client = _active_clients.pop(account_id)
        await client.disconnect()


async def disconnect_all_clients():
    """Disconnect all active clients"""
    for account_id in list(_active_clients.keys()):
        await disconnect_client(account_id)
