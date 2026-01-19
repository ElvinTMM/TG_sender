"""
Campaign execution service with smart account rotation and limits
"""
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
import uuid
import random
import re

from config import db


async def get_available_accounts(user_id: str, account_categories: List[str] = None, account_ids: List[str] = None) -> List[dict]:
    """Get available accounts based on categories or IDs, respecting limits"""
    account_query = {"user_id": user_id, "status": "active"}
    
    if account_categories:
        category_conditions = []
        if "low" in account_categories:
            category_conditions.append({"$or": [{"value_usdt": {"$lt": 300}}, {"value_usdt": {"$exists": False}}]})
        if "medium" in account_categories:
            category_conditions.append({"value_usdt": {"$gte": 300, "$lt": 500}})
        if "high" in account_categories:
            category_conditions.append({"value_usdt": {"$gte": 500}})
        
        if category_conditions:
            account_query["$or"] = category_conditions
    elif account_ids:
        account_query["id"] = {"$in": account_ids}
    
    accounts = await db.telegram_accounts.find(account_query, {"_id": 0}).to_list(100)
    
    # Reset counters if needed
    now = datetime.now(timezone.utc)
    for acc in accounts:
        await reset_account_counters(acc, now)
    
    # Re-fetch to get updated counters
    accounts = await db.telegram_accounts.find(account_query, {"_id": 0}).to_list(100)
    return accounts


async def reset_account_counters(account: dict, now: datetime):
    """Reset hourly/daily counters if time has passed"""
    updates = {}
    
    last_hour_reset = account.get("last_hour_reset")
    if last_hour_reset:
        last_hour_dt = datetime.fromisoformat(last_hour_reset.replace('Z', '+00:00'))
        if (now - last_hour_dt) >= timedelta(hours=1):
            updates["messages_sent_hour"] = 0
            updates["last_hour_reset"] = now.isoformat()
    
    last_day_reset = account.get("last_day_reset")
    if last_day_reset:
        last_day_dt = datetime.fromisoformat(last_day_reset.replace('Z', '+00:00'))
        if (now - last_day_dt) >= timedelta(days=1):
            updates["messages_sent_today"] = 0
            updates["last_day_reset"] = now.isoformat()
    
    if updates:
        await db.telegram_accounts.update_one({"id": account["id"]}, {"$set": updates})


def select_best_account(accounts: List[dict], account_msg_count: Dict[str, int], respect_limits: bool = True) -> dict:
    """Select the best account for sending - least loaded and within limits"""
    available = []
    
    for acc in accounts:
        limits = acc.get("limits", {})
        max_per_hour = limits.get("max_per_hour", 20)
        max_per_day = limits.get("max_per_day", 100)
        
        current_hour = acc.get("messages_sent_hour", 0) + account_msg_count.get(acc["id"], 0)
        current_day = acc.get("messages_sent_today", 0) + account_msg_count.get(acc["id"], 0)
        
        if respect_limits:
            if current_hour >= max_per_hour or current_day >= max_per_day:
                continue
        
        available.append({
            "account": acc,
            "load": current_hour,
            "remaining_hour": max_per_hour - current_hour,
            "remaining_day": max_per_day - current_day
        })
    
    if not available:
        return None
    
    # Sort by load (least loaded first), then by remaining capacity
    available.sort(key=lambda x: (x["load"], -x["remaining_hour"]))
    return available[0]["account"]


def process_template(template: str, contact: dict) -> str:
    """Process message template with variables and spintax"""
    text = template
    
    # Replace variables
    name = contact.get("name") or "друг"
    text = text.replace("{name}", name)
    text = text.replace("{first_name}", name.split()[0] if name else "друг")
    text = text.replace("{phone}", contact.get("phone", ""))
    
    # Time of day
    hour = datetime.now().hour
    if hour < 12:
        time_greeting = "Доброе утро"
    elif hour < 18:
        time_greeting = "Добрый день"
    else:
        time_greeting = "Добрый вечер"
    text = text.replace("{time}", time_greeting)
    
    # Process spintax {option1|option2|option3}
    def replace_spintax(match):
        options = match.group(1).split("|")
        return random.choice(options)
    
    text = re.sub(r'\{([^{}]+\|[^{}]+)\}', replace_spintax, text)
    
    return text


async def execute_campaign(campaign: dict, user_id: str) -> Dict[str, Any]:
    """Execute a campaign with smart rotation and limits"""
    
    # Get contacts
    contact_query = {"user_id": user_id, "status": "pending"}
    if campaign.get("contact_ids"):
        contact_query["id"] = {"$in": campaign["contact_ids"]}
    elif campaign.get("tag_filter"):
        contact_query["tags"] = campaign["tag_filter"]
    
    contacts = await db.contacts.find(contact_query, {"_id": 0}).to_list(500)
    
    # Get accounts
    accounts = await get_available_accounts(
        user_id,
        campaign.get("account_categories", []),
        campaign.get("account_ids", [])
    )
    
    if not accounts:
        return {"error": "No active accounts available in selected categories"}
    
    messages_sent = 0
    messages_delivered = 0
    messages_failed = 0
    use_rotation = campaign.get("use_rotation", True)
    respect_limits = campaign.get("respect_limits", True)
    
    account_msg_count = {acc["id"]: 0 for acc in accounts}
    skipped_due_to_limits = 0
    
    for contact in contacts:
        # Select best account
        if use_rotation:
            account = select_best_account(accounts, account_msg_count, respect_limits)
        else:
            # Simple round-robin without limit check
            account = accounts[messages_sent % len(accounts)]
        
        if not account:
            skipped_due_to_limits += 1
            continue
        
        # Process message template
        message_text = process_template(campaign["message_template"], contact)
        
        # Simulate message sending (90% delivery rate)
        delivered = random.random() > 0.1
        
        # Create dialog entry
        dialog = await db.dialogs.find_one({
            "contact_id": contact["id"],
            "user_id": user_id
        })
        
        message_entry = {
            "id": str(uuid.uuid4()),
            "direction": "outgoing",
            "text": message_text,
            "status": "delivered" if delivered else "failed",
            "account_id": account["id"],
            "account_phone": account["phone"],
            "account_category": account.get("price_category", "low"),
            "sent_at": datetime.now(timezone.utc).isoformat()
        }
        
        if dialog:
            await db.dialogs.update_one(
                {"id": dialog["id"]},
                {
                    "$push": {"messages": message_entry},
                    "$set": {"last_message_at": datetime.now(timezone.utc).isoformat()}
                }
            )
        else:
            dialog_doc = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "contact_id": contact["id"],
                "contact_phone": contact["phone"],
                "contact_name": contact.get("name"),
                "account_id": account["id"],
                "account_phone": account["phone"],
                "messages": [message_entry],
                "last_message_at": datetime.now(timezone.utc).isoformat(),
                "has_response": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.dialogs.insert_one(dialog_doc)
        
        messages_sent += 1
        account_msg_count[account["id"]] += 1
        
        if delivered:
            messages_delivered += 1
            await db.contacts.update_one(
                {"id": contact["id"]},
                {"$set": {"status": "messaged", "last_contacted": datetime.now(timezone.utc).isoformat()}}
            )
            await db.telegram_accounts.update_one(
                {"id": account["id"]},
                {
                    "$inc": {"total_messages_sent": 1, "total_messages_delivered": 1, "messages_sent_today": 1, "messages_sent_hour": 1},
                    "$set": {"last_active": datetime.now(timezone.utc).isoformat()}
                }
            )
        else:
            messages_failed += 1
            await db.telegram_accounts.update_one(
                {"id": account["id"]},
                {"$inc": {"total_messages_sent": 1, "messages_sent_today": 1, "messages_sent_hour": 1}}
            )
    
    # Simulate responses (5-15%)
    responded = int(messages_delivered * random.uniform(0.05, 0.15))
    
    if responded > 0:
        dialogs_with_msgs = await db.dialogs.find({"user_id": user_id, "has_response": False}).to_list(responded)
        for dialog in dialogs_with_msgs[:responded]:
            response_entry = {
                "id": str(uuid.uuid4()),
                "direction": "incoming",
                "text": random.choice([
                    "Здравствуйте, интересно",
                    "Расскажите подробнее",
                    "Сколько стоит?",
                    "Перезвоните мне",
                    "Не интересует"
                ]),
                "status": "received",
                "received_at": datetime.now(timezone.utc).isoformat()
            }
            await db.dialogs.update_one(
                {"id": dialog["id"]},
                {
                    "$push": {"messages": response_entry},
                    "$set": {"has_response": True, "last_message_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            await db.contacts.update_one(
                {"id": dialog["contact_id"]},
                {"$set": {"status": "responded"}}
            )
    
    # Simulate some contacts reading but not responding
    read_count = int(messages_delivered * random.uniform(0.3, 0.5)) - responded
    if read_count > 0:
        messaged_contacts = await db.contacts.find({
            "user_id": user_id,
            "status": "messaged"
        }).to_list(read_count)
        
        for contact in messaged_contacts[:read_count]:
            await db.contacts.update_one(
                {"id": contact["id"]},
                {"$set": {"status": "read", "read_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    # Get category distribution
    category_stats = {}
    for acc_id, count in account_msg_count.items():
        if count > 0:
            acc = next((a for a in accounts if a["id"] == acc_id), None)
            if acc:
                cat = acc.get("price_category", "low")
                category_stats[cat] = category_stats.get(cat, 0) + count
    
    return {
        "sent": messages_sent,
        "delivered": messages_delivered,
        "failed": messages_failed,
        "responses": responded,
        "skipped_due_to_limits": skipped_due_to_limits,
        "accounts_used": len([a for a in accounts if account_msg_count[a["id"]] > 0]),
        "by_category": category_stats
    }
