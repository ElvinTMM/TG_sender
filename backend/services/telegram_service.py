"""
Telegram service using Telethon for real message sending
"""
import os
import asyncio
import logging
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


async def get_client(account_id: str, phone: str, session_string: str = None, proxy: dict = None) -> TelegramClient:
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
            proxy_config = (socks.SOCKS5, proxy['host'], proxy['port'], True, 
                          proxy.get('username'), proxy.get('password'))
        elif proxy_type == 'socks4':
            import socks
            proxy_config = (socks.SOCKS4, proxy['host'], proxy['port'], True)
        elif proxy_type == 'http':
            import socks
            proxy_config = (socks.HTTP, proxy['host'], proxy['port'], True,
                          proxy.get('username'), proxy.get('password'))
    
    # Create client
    client = TelegramClient(
        session,
        int(API_ID),
        API_HASH,
        proxy=proxy_config,
        connection_retries=3,
        retry_delay=1,
        timeout=30
    )
    
    await client.connect()
    _active_clients[account_id] = client
    
    return client


async def start_authorization(account_id: str, phone: str, proxy: dict = None) -> Dict[str, Any]:
    """Start phone authorization - sends SMS code"""
    try:
        client = await get_client(account_id, phone, proxy=proxy)
        
        if await client.is_user_authorized():
            # Already authorized
            me = await client.get_me()
            session_string = client.session.save()
            
            # Update account in DB
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
        
        # Send code request
        result = await client.send_code_request(phone)
        
        # Store phone_code_hash for verification
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
    """Verify SMS code"""
    try:
        client = await get_client(account_id, phone, proxy=proxy)
        
        try:
            # Sign in with code
            await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
            
        except SessionPasswordNeededError:
            # 2FA enabled
            return {
                "status": "2fa_required",
                "message": "Two-factor authentication required"
            }
        
        # Get user info
        me = await client.get_me()
        session_string = client.session.save()
        
        # Update account
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
    """Verify 2FA password"""
    try:
        client = await get_client(account_id, phone, proxy=proxy)
        
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
        client = await get_client(account_id, phone, session_string, proxy)
        
        if not await client.is_user_authorized():
            return {"status": "error", "message": "Account not authorized"}
        
        # Find user by phone
        try:
            # Import contact first
            result = await client.get_entity(recipient_phone)
            
            # Send message
            sent_message = await client.send_message(result, message)
            
            return {
                "status": "sent",
                "message_id": sent_message.id,
                "date": sent_message.date.isoformat()
            }
            
        except ValueError:
            # User not found - try to add as contact
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
        client = await get_client(account_id, phone, session_string, proxy)
        
        if not await client.is_user_authorized():
            return {"status": "error", "message": "Account not authorized"}
        
        # Find recipient
        try:
            result = await client.get_entity(recipient_phone)
            
            # Send voice message
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
        client = await get_client(account_id, phone, session_string, proxy)
        
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
