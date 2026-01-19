"""
Follow-up service - handles "read but not replied" logic with REAL Telegram sending
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import uuid
import asyncio
import logging

from config import db, UPLOAD_DIR
from services.telegram_service import send_voice_message

logger = logging.getLogger(__name__)


async def get_read_not_replied_contacts(user_id: str) -> list:
    """Get contacts who read the message but didn't reply"""
    contacts = await db.contacts.find({
        "user_id": user_id,
        "status": "read"
    }, {"_id": 0}).to_list(1000)
    return contacts


async def add_to_followup_queue(user_id: str, voice_message_id: str) -> Dict[str, Any]:
    """Add all read-but-not-replied contacts to follow-up queue"""
    voice = await db.voice_messages.find_one({"id": voice_message_id, "user_id": user_id})
    if not voice:
        return {"error": "Voice message not found", "added": 0}
    
    read_contacts = await get_read_not_replied_contacts(user_id)
    
    added = 0
    already_in_queue = 0
    
    for contact in read_contacts:
        # Check if already in pending queue
        existing = await db.followup_queue.find_one({
            "contact_id": contact["id"],
            "status": "pending"
        })
        if existing:
            already_in_queue += 1
            continue
        
        queue_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "contact_id": contact["id"],
            "contact_phone": contact["phone"],
            "contact_name": contact.get("name"),
            "voice_message_id": voice_message_id,
            "voice_message_name": voice["name"],
            "status": "pending",
            "read_at": contact.get("read_at", datetime.now(timezone.utc).isoformat()),
            "scheduled_at": (datetime.now(timezone.utc) + timedelta(minutes=voice["delay_minutes"])).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.followup_queue.insert_one(queue_doc)
        added += 1
    
    return {
        "added": added,
        "already_in_queue": already_in_queue,
        "total_read_contacts": len(read_contacts)
    }


async def process_followup_queue(user_id: str) -> Dict[str, Any]:
    """Process pending follow-ups - REAL voice message sending via Telegram"""
    now = datetime.now(timezone.utc)
    
    # Find all pending items
    pending_items = await db.followup_queue.find({
        "user_id": user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(500)
    
    if not pending_items:
        return {
            "processed": 0,
            "sent": 0,
            "failed": 0,
            "message": "No pending follow-ups"
        }
    
    # Get an authorized account for sending
    account = await db.telegram_accounts.find_one({
        "user_id": user_id,
        "status": "active",
        "session_string": {"$exists": True, "$ne": None}
    }, {"_id": 0})
    
    if not account:
        return {
            "processed": 0,
            "sent": 0,
            "failed": 0,
            "message": "No authorized accounts available. Please authorize an account first."
        }
    
    sent = 0
    failed = 0
    errors = []
    
    for item in pending_items:
        # Get voice message file
        voice = await db.voice_messages.find_one({"id": item.get("voice_message_id")})
        if not voice:
            await db.followup_queue.update_one(
                {"id": item["id"]},
                {"$set": {"status": "failed", "error": "Voice message not found", "failed_at": now.isoformat()}}
            )
            failed += 1
            continue
        
        voice_file_path = str(UPLOAD_DIR / voice["filename"])
        
        # REAL Telegram voice message sending
        result = await send_voice_message(
            account_id=account["id"],
            phone=account["phone"],
            session_string=account["session_string"],
            recipient_phone=item["contact_phone"],
            voice_file_path=voice_file_path,
            proxy=account.get("proxy")
        )
        
        if result.get("status") == "sent":
            await db.followup_queue.update_one(
                {"id": item["id"]},
                {"$set": {"status": "sent", "sent_at": now.isoformat()}}
            )
            
            # Update contact status
            await db.contacts.update_one(
                {"id": item["contact_id"]},
                {"$set": {"status": "voice_sent", "voice_sent_at": now.isoformat()}}
            )
            
            # Update voice message counter
            await db.voice_messages.update_one(
                {"id": item["voice_message_id"]},
                {"$inc": {"sent_count": 1}}
            )
            
            # Add to dialog
            dialog = await db.dialogs.find_one({"contact_id": item["contact_id"]})
            if dialog:
                await db.dialogs.update_one(
                    {"id": dialog["id"]},
                    {"$push": {"messages": {
                        "id": str(uuid.uuid4()),
                        "direction": "outgoing",
                        "type": "voice",
                        "text": f"🎤 Голосовое сообщение: {item.get('voice_message_name', 'Без названия')}",
                        "status": "delivered",
                        "telegram_message_id": result.get("message_id"),
                        "sent_at": now.isoformat()
                    }}}
                )
            
            sent += 1
            logger.info(f"Voice sent to {item['contact_phone']}")
            
            # Delay between sends
            await asyncio.sleep(30)
        else:
            error_msg = result.get("message", "Unknown error")
            await db.followup_queue.update_one(
                {"id": item["id"]},
                {"$set": {"status": "failed", "error": error_msg, "failed_at": now.isoformat()}}
            )
            errors.append({"contact": item["contact_phone"], "error": error_msg})
            failed += 1
            logger.error(f"Voice failed to {item['contact_phone']}: {error_msg}")
    
    return {
        "processed": len(pending_items),
        "sent": sent,
        "failed": failed,
        "errors": errors[:5] if errors else []
    }


async def get_followup_stats(user_id: str) -> Dict[str, Any]:
    """Get statistics about follow-up queue"""
    pending = await db.followup_queue.count_documents({"user_id": user_id, "status": "pending"})
    sent = await db.followup_queue.count_documents({"user_id": user_id, "status": "sent"})
    failed = await db.followup_queue.count_documents({"user_id": user_id, "status": "failed"})
    cancelled = await db.followup_queue.count_documents({"user_id": user_id, "status": "cancelled"})
    
    read_contacts = await db.contacts.count_documents({"user_id": user_id, "status": "read"})
    
    return {
        "pending": pending,
        "sent": sent,
        "failed": failed,
        "cancelled": cancelled,
        "read_not_in_queue": read_contacts
    }
