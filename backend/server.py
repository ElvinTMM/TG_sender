from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import pandas as pd
from io import BytesIO
import json
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    created_at: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class ProxyConfig(BaseModel):
    enabled: bool = False
    type: str = "socks5"  # socks5, socks4, http
    host: str = ""
    port: int = 0
    username: Optional[str] = None
    password: Optional[str] = None

class AccountLimits(BaseModel):
    max_per_hour: int = 20
    max_per_day: int = 100
    delay_min: int = 30
    delay_max: int = 90

class TelegramAccountCreate(BaseModel):
    phone: str
    name: Optional[str] = None
    api_id: Optional[str] = None
    api_hash: Optional[str] = None
    session_string: Optional[str] = None
    proxy: Optional[ProxyConfig] = None
    limits: Optional[AccountLimits] = None

class TelegramAccountResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    phone: str
    name: Optional[str]
    status: str
    proxy: Optional[dict]
    limits: Optional[dict]
    messages_sent_today: int
    messages_sent_hour: int
    total_messages_sent: int
    total_messages_delivered: int
    created_at: str
    last_active: Optional[str]

class ContactCreate(BaseModel):
    phone: str
    name: Optional[str] = None
    tags: Optional[List[str]] = []

class ContactResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    phone: str
    name: Optional[str]
    tags: List[str]
    status: str
    created_at: str
    last_contacted: Optional[str]

class CampaignCreate(BaseModel):
    name: str
    message_template: str
    account_ids: List[str]
    contact_ids: Optional[List[str]] = None
    tag_filter: Optional[str] = None
    use_rotation: bool = True
    respect_limits: bool = True

class CampaignResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    message_template: str
    status: str
    use_rotation: bool
    total_contacts: int
    messages_sent: int
    messages_delivered: int
    messages_failed: int
    responses_count: int
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]

class DialogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: str
    contact_phone: str
    contact_name: Optional[str]
    account_id: str
    account_phone: str
    messages: List[dict]
    last_message_at: str
    has_response: bool

class TemplateCreate(BaseModel):
    name: str
    content: str
    description: Optional[str] = None

class TemplateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    content: str
    description: Optional[str]
    created_at: str
    updated_at: Optional[str]

class AnalyticsResponse(BaseModel):
    total_accounts: int
    active_accounts: int
    banned_accounts: int
    total_contacts: int
    messaged_contacts: int
    responded_contacts: int
    total_campaigns: int
    running_campaigns: int
    total_messages_sent: int
    total_messages_delivered: int
    total_responses: int
    delivery_rate: float
    response_rate: float
    daily_stats: List[dict]

# ==================== AUTH HELPERS ====================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": get_password_hash(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user_id})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name, created_at=user_doc["created_at"])
    )

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["id"]})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        created_at=current_user["created_at"]
    )

# ==================== TELEGRAM ACCOUNTS ROUTES ====================

@api_router.get("/accounts", response_model=List[TelegramAccountResponse])
async def get_accounts(current_user: dict = Depends(get_current_user)):
    accounts = await db.telegram_accounts.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return [TelegramAccountResponse(**acc) for acc in accounts]

@api_router.post("/accounts", response_model=TelegramAccountResponse)
async def create_account(account: TelegramAccountCreate, current_user: dict = Depends(get_current_user)):
    account_id = str(uuid.uuid4())
    
    proxy_data = account.proxy.model_dump() if account.proxy else {"enabled": False, "type": "socks5", "host": "", "port": 0}
    limits_data = account.limits.model_dump() if account.limits else {"max_per_hour": 20, "max_per_day": 100, "delay_min": 30, "delay_max": 90}
    
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

@api_router.put("/accounts/{account_id}", response_model=TelegramAccountResponse)
async def update_account(account_id: str, account: TelegramAccountCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.telegram_accounts.find_one({"id": account_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    
    update_data = {
        "phone": account.phone,
        "name": account.name or account.phone,
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
    return TelegramAccountResponse(**{k: v for k, v in updated.items() if k not in ["user_id", "api_id", "api_hash", "session_string"]})

@api_router.post("/accounts/import")
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

@api_router.put("/accounts/{account_id}/status")
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

@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.telegram_accounts.delete_one({"id": account_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account deleted"}

# ==================== CONTACTS ROUTES ====================

@api_router.get("/contacts", response_model=List[ContactResponse])
async def get_contacts(tag: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if tag:
        query["tags"] = tag
    if status:
        query["status"] = status
    
    contacts = await db.contacts.find(query, {"_id": 0}).to_list(10000)
    return [ContactResponse(**c) for c in contacts]

@api_router.post("/contacts", response_model=ContactResponse)
async def create_contact(contact: ContactCreate, current_user: dict = Depends(get_current_user)):
    contact_id = str(uuid.uuid4())
    contact_doc = {
        "id": contact_id,
        "user_id": current_user["id"],
        "phone": contact.phone,
        "name": contact.name,
        "tags": contact.tags or [],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_contacted": None
    }
    await db.contacts.insert_one(contact_doc)
    return ContactResponse(**{k: v for k, v in contact_doc.items() if k != "user_id"})

@api_router.post("/contacts/import")
async def import_contacts(file: UploadFile = File(...), tag: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    content = await file.read()
    contacts = []
    
    if file.filename.endswith('.json'):
        data = json.loads(content.decode('utf-8'))
        contacts = data if isinstance(data, list) else [data]
    elif file.filename.endswith('.csv'):
        df = pd.read_csv(BytesIO(content))
        contacts = df.to_dict('records')
    elif file.filename.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(BytesIO(content))
        contacts = df.to_dict('records')
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    
    imported = 0
    for c in contacts:
        contact_id = str(uuid.uuid4())
        phone = str(c.get('phone', c.get('Phone', c.get('номер', c.get('Номер', ''))))).strip()
        if not phone:
            continue
        
        existing = await db.contacts.find_one({"phone": phone, "user_id": current_user["id"]})
        if existing:
            continue
        
        tags = []
        if tag:
            tags.append(tag)
        if 'tags' in c:
            tags.extend(c['tags'] if isinstance(c['tags'], list) else [c['tags']])
        
        contact_doc = {
            "id": contact_id,
            "user_id": current_user["id"],
            "phone": phone,
            "name": c.get('name', c.get('Name', c.get('имя', c.get('Имя')))),
            "tags": tags,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_contacted": None
        }
        await db.contacts.insert_one(contact_doc)
        imported += 1
    
    return {"message": f"Successfully imported {imported} contacts", "imported": imported}

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.contacts.delete_one({"id": contact_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}

@api_router.delete("/contacts")
async def delete_all_contacts(current_user: dict = Depends(get_current_user)):
    result = await db.contacts.delete_many({"user_id": current_user["id"]})
    return {"message": f"Deleted {result.deleted_count} contacts"}

# ==================== CAMPAIGNS ROUTES ====================

@api_router.get("/campaigns", response_model=List[CampaignResponse])
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    campaigns = await db.campaigns.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return [CampaignResponse(**c) for c in campaigns]

@api_router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(campaign: CampaignCreate, current_user: dict = Depends(get_current_user)):
    campaign_id = str(uuid.uuid4())
    
    contact_query = {"user_id": current_user["id"]}
    if campaign.contact_ids:
        contact_query["id"] = {"$in": campaign.contact_ids}
    elif campaign.tag_filter:
        contact_query["tags"] = campaign.tag_filter
    
    total_contacts = await db.contacts.count_documents(contact_query)
    
    campaign_doc = {
        "id": campaign_id,
        "user_id": current_user["id"],
        "name": campaign.name,
        "message_template": campaign.message_template,
        "account_ids": campaign.account_ids,
        "contact_ids": campaign.contact_ids,
        "tag_filter": campaign.tag_filter,
        "use_rotation": campaign.use_rotation,
        "respect_limits": campaign.respect_limits,
        "status": "draft",
        "total_contacts": total_contacts,
        "messages_sent": 0,
        "messages_delivered": 0,
        "messages_failed": 0,
        "responses_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "started_at": None,
        "completed_at": None
    }
    await db.campaigns.insert_one(campaign_doc)
    return CampaignResponse(**{k: v for k, v in campaign_doc.items() if k != "user_id"})

@api_router.put("/campaigns/{campaign_id}/start")
async def start_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    campaign = await db.campaigns.find_one({"id": campaign_id, "user_id": current_user["id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign["status"] == "running":
        raise HTTPException(status_code=400, detail="Campaign is already running")
    
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"status": "running", "started_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    contact_query = {"user_id": current_user["id"], "status": "pending"}
    if campaign.get("contact_ids"):
        contact_query["id"] = {"$in": campaign["contact_ids"]}
    elif campaign.get("tag_filter"):
        contact_query["tags"] = campaign["tag_filter"]
    
    contacts = await db.contacts.find(contact_query, {"_id": 0}).to_list(500)
    accounts = await db.telegram_accounts.find(
        {"id": {"$in": campaign["account_ids"]}, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    if not accounts:
        raise HTTPException(status_code=400, detail="No active accounts available")
    
    messages_sent = 0
    messages_delivered = 0
    messages_failed = 0
    use_rotation = campaign.get("use_rotation", True)
    
    account_index = 0
    account_msg_count = {acc["id"]: 0 for acc in accounts}
    
    for contact in contacts:
        # Rotation logic - pick next available account
        if use_rotation:
            # Find account with least messages sent in this batch
            account = min(accounts, key=lambda a: account_msg_count[a["id"]])
        else:
            account = accounts[account_index % len(accounts)]
        
        # Check limits
        acc_limits = account.get("limits", {})
        max_per_hour = acc_limits.get("max_per_hour", 20)
        
        if account_msg_count[account["id"]] >= max_per_hour:
            # Skip this account, try next
            available = [a for a in accounts if account_msg_count[a["id"]] < a.get("limits", {}).get("max_per_hour", 20)]
            if not available:
                break  # All accounts exhausted
            account = available[0]
        
        # Simulate message sending (90% delivery rate)
        delivered = random.random() > 0.1
        
        # Create dialog entry
        dialog = await db.dialogs.find_one({
            "contact_id": contact["id"],
            "user_id": current_user["id"]
        })
        
        message_entry = {
            "id": str(uuid.uuid4()),
            "direction": "outgoing",
            "text": campaign["message_template"],
            "status": "delivered" if delivered else "failed",
            "account_id": account["id"],
            "account_phone": account["phone"],
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
                "user_id": current_user["id"],
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
        
        account_index += 1
    
    # Simulate responses (5-15%)
    responded = int(messages_delivered * random.uniform(0.05, 0.15))
    
    # Add simulated responses to random dialogs
    if responded > 0:
        dialogs_with_msgs = await db.dialogs.find({"user_id": current_user["id"], "has_response": False}).to_list(responded)
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
    
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "completed",
            "messages_sent": messages_sent,
            "messages_delivered": messages_delivered,
            "messages_failed": messages_failed,
            "responses_count": responded,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Campaign completed",
        "sent": messages_sent,
        "delivered": messages_delivered,
        "failed": messages_failed,
        "responses": responded,
        "accounts_used": len(set(acc["id"] for acc in accounts if account_msg_count[acc["id"]] > 0))
    }

@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.campaigns.delete_one({"id": campaign_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign deleted"}

# ==================== DIALOGS ROUTES ====================

@api_router.get("/dialogs", response_model=List[DialogResponse])
async def get_dialogs(has_response: Optional[bool] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if has_response is not None:
        query["has_response"] = has_response
    
    dialogs = await db.dialogs.find(query, {"_id": 0}).sort("last_message_at", -1).to_list(500)
    return [DialogResponse(**d) for d in dialogs]

@api_router.get("/dialogs/{dialog_id}", response_model=DialogResponse)
async def get_dialog(dialog_id: str, current_user: dict = Depends(get_current_user)):
    dialog = await db.dialogs.find_one({"id": dialog_id, "user_id": current_user["id"]}, {"_id": 0})
    if not dialog:
        raise HTTPException(status_code=404, detail="Dialog not found")
    return DialogResponse(**dialog)

@api_router.post("/dialogs/{dialog_id}/reply")
async def reply_to_dialog(dialog_id: str, message: str, current_user: dict = Depends(get_current_user)):
    dialog = await db.dialogs.find_one({"id": dialog_id, "user_id": current_user["id"]})
    if not dialog:
        raise HTTPException(status_code=404, detail="Dialog not found")
    
    message_entry = {
        "id": str(uuid.uuid4()),
        "direction": "outgoing",
        "text": message,
        "status": "delivered",  # Simulated
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dialogs.update_one(
        {"id": dialog_id},
        {
            "$push": {"messages": message_entry},
            "$set": {"last_message_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Reply sent", "message_id": message_entry["id"]}

# ==================== ANALYTICS ROUTES ====================

@api_router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    
    total_accounts = await db.telegram_accounts.count_documents({"user_id": user_id})
    active_accounts = await db.telegram_accounts.count_documents({"user_id": user_id, "status": "active"})
    banned_accounts = await db.telegram_accounts.count_documents({"user_id": user_id, "status": "banned"})
    
    total_contacts = await db.contacts.count_documents({"user_id": user_id})
    messaged_contacts = await db.contacts.count_documents({"user_id": user_id, "status": {"$in": ["messaged", "responded"]}})
    responded_contacts = await db.contacts.count_documents({"user_id": user_id, "status": "responded"})
    
    total_campaigns = await db.campaigns.count_documents({"user_id": user_id})
    running_campaigns = await db.campaigns.count_documents({"user_id": user_id, "status": "running"})
    
    campaign_stats = await db.campaigns.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_sent": {"$sum": "$messages_sent"},
            "total_delivered": {"$sum": "$messages_delivered"},
            "total_responses": {"$sum": "$responses_count"}
        }}
    ]).to_list(1)
    
    total_messages_sent = campaign_stats[0].get("total_sent", 0) if campaign_stats else 0
    total_messages_delivered = campaign_stats[0].get("total_delivered", 0) if campaign_stats else 0
    total_responses = campaign_stats[0].get("total_responses", 0) if campaign_stats else 0
    
    delivery_rate = (total_messages_delivered / total_messages_sent * 100) if total_messages_sent > 0 else 0
    response_rate = (total_responses / total_messages_delivered * 100) if total_messages_delivered > 0 else 0
    
    daily_stats = []
    for i in range(7):
        day = datetime.now(timezone.utc) - timedelta(days=6-i)
        daily_stats.append({
            "date": day.strftime("%Y-%m-%d"),
            "sent": int(total_messages_sent / 7 * (0.8 + 0.4 * (i / 6))) if total_messages_sent > 0 else 0,
            "delivered": int(total_messages_delivered / 7 * (0.8 + 0.4 * (i / 6))) if total_messages_delivered > 0 else 0,
            "responses": int(total_responses / 7 * (0.8 + 0.4 * (i / 6))) if total_responses > 0 else 0
        })
    
    return AnalyticsResponse(
        total_accounts=total_accounts,
        active_accounts=active_accounts,
        banned_accounts=banned_accounts,
        total_contacts=total_contacts,
        messaged_contacts=messaged_contacts,
        responded_contacts=responded_contacts,
        total_campaigns=total_campaigns,
        running_campaigns=running_campaigns,
        total_messages_sent=total_messages_sent,
        total_messages_delivered=total_messages_delivered,
        total_responses=total_responses,
        delivery_rate=round(delivery_rate, 1),
        response_rate=round(response_rate, 1),
        daily_stats=daily_stats
    )

# ==================== TEMPLATES ROUTES ====================

@api_router.get("/templates", response_model=List[TemplateResponse])
async def get_templates(current_user: dict = Depends(get_current_user)):
    templates = await db.templates.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return [TemplateResponse(**t) for t in templates]

@api_router.post("/templates", response_model=TemplateResponse)
async def create_template(template: TemplateCreate, current_user: dict = Depends(get_current_user)):
    template_id = str(uuid.uuid4())
    template_doc = {
        "id": template_id,
        "user_id": current_user["id"],
        "name": template.name,
        "content": template.content,
        "description": template.description,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    await db.templates.insert_one(template_doc)
    return TemplateResponse(**{k: v for k, v in template_doc.items() if k != "user_id"})

@api_router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: str, template: TemplateCreate, current_user: dict = Depends(get_current_user)):
    result = await db.templates.update_one(
        {"id": template_id, "user_id": current_user["id"]},
        {"$set": {
            "name": template.name,
            "content": template.content,
            "description": template.description,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    updated = await db.templates.find_one({"id": template_id}, {"_id": 0})
    return TemplateResponse(**{k: v for k, v in updated.items() if k != "user_id"})

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.templates.delete_one({"id": template_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# Helper function to process template with variables and spintax
def process_template(template: str, contact: dict) -> str:
    import re
    
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

@api_router.get("/")
async def root():
    return {"message": "Telegram Bot Manager API", "status": "ok"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
