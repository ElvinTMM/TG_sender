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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
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

class TelegramAccountCreate(BaseModel):
    phone: str
    session_string: Optional[str] = None
    api_id: Optional[str] = None
    api_hash: Optional[str] = None
    name: Optional[str] = None

class TelegramAccountResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    phone: str
    name: Optional[str]
    status: str  # active, banned, pending
    messages_sent: int
    messages_delivered: int
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
    status: str  # pending, messaged, responded, blocked
    created_at: str
    last_contacted: Optional[str]

class CampaignCreate(BaseModel):
    name: str
    message_template: str
    account_ids: List[str]
    contact_ids: Optional[List[str]] = None
    tag_filter: Optional[str] = None
    delay_min: int = 30
    delay_max: int = 60

class CampaignResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    message_template: str
    status: str  # draft, running, paused, completed
    total_contacts: int
    messages_sent: int
    messages_delivered: int
    messages_failed: int
    responses_count: int
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    campaign_id: str
    account_id: str
    contact_id: str
    status: str  # sent, delivered, failed, responded
    sent_at: str
    delivered_at: Optional[str]
    response_at: Optional[str]

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
    account_doc = {
        "id": account_id,
        "user_id": current_user["id"],
        "phone": account.phone,
        "name": account.name or account.phone,
        "session_string": account.session_string,
        "api_id": account.api_id,
        "api_hash": account.api_hash,
        "status": "pending",
        "messages_sent": 0,
        "messages_delivered": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_active": None
    }
    await db.telegram_accounts.insert_one(account_doc)
    return TelegramAccountResponse(**{k: v for k, v in account_doc.items() if k != "user_id"})

@api_router.post("/accounts/import")
async def import_accounts(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
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
            
        account_doc = {
            "id": account_id,
            "user_id": current_user["id"],
            "phone": phone,
            "name": acc.get('name', phone),
            "session_string": acc.get('session_string'),
            "api_id": acc.get('api_id'),
            "api_hash": acc.get('api_hash'),
            "status": "active",
            "messages_sent": 0,
            "messages_delivered": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active": None
        }
        await db.telegram_accounts.insert_one(account_doc)
        imported += 1
    
    return {"message": f"Successfully imported {imported} accounts", "imported": imported}

@api_router.put("/accounts/{account_id}/status")
async def update_account_status(
    account_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
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
async def get_contacts(
    tag: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
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
async def import_contacts(
    file: UploadFile = File(...),
    tag: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
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
        raise HTTPException(status_code=400, detail="Unsupported file format. Use JSON, CSV, or Excel")
    
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

@api_router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    campaign = await db.campaigns.find_one({"id": campaign_id, "user_id": current_user["id"]}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse(**campaign)

@api_router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(campaign: CampaignCreate, current_user: dict = Depends(get_current_user)):
    campaign_id = str(uuid.uuid4())
    
    # Count contacts
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
        "delay_min": campaign.delay_min,
        "delay_max": campaign.delay_max,
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
    
    # Simulate sending messages (in real app, this would be a background task with Telethon)
    import asyncio
    import random
    
    contact_query = {"user_id": current_user["id"]}
    if campaign.get("contact_ids"):
        contact_query["id"] = {"$in": campaign["contact_ids"]}
    elif campaign.get("tag_filter"):
        contact_query["tags"] = campaign["tag_filter"]
    
    contacts = await db.contacts.find(contact_query, {"_id": 0}).to_list(100)
    accounts = await db.telegram_accounts.find(
        {"id": {"$in": campaign["account_ids"]}, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    if not accounts:
        raise HTTPException(status_code=400, detail="No active accounts available")
    
    messages_sent = 0
    messages_delivered = 0
    messages_failed = 0
    
    for i, contact in enumerate(contacts[:50]):  # Limit to 50 for demo
        account = accounts[i % len(accounts)]
        
        # Simulate message sending
        delivered = random.random() > 0.1  # 90% delivery rate
        
        message_doc = {
            "id": str(uuid.uuid4()),
            "campaign_id": campaign_id,
            "account_id": account["id"],
            "contact_id": contact["id"],
            "contact_phone": contact["phone"],
            "status": "delivered" if delivered else "failed",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "delivered_at": datetime.now(timezone.utc).isoformat() if delivered else None,
            "response_at": None
        }
        await db.messages.insert_one(message_doc)
        
        messages_sent += 1
        if delivered:
            messages_delivered += 1
            await db.contacts.update_one(
                {"id": contact["id"]},
                {"$set": {"status": "messaged", "last_contacted": datetime.now(timezone.utc).isoformat()}}
            )
            await db.telegram_accounts.update_one(
                {"id": account["id"]},
                {"$inc": {"messages_sent": 1, "messages_delivered": 1}, "$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            messages_failed += 1
            await db.telegram_accounts.update_one(
                {"id": account["id"]},
                {"$inc": {"messages_sent": 1}}
            )
    
    # Simulate some responses
    responded = int(messages_delivered * random.uniform(0.05, 0.15))
    
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
    
    return {"message": "Campaign completed", "sent": messages_sent, "delivered": messages_delivered, "failed": messages_failed}

@api_router.put("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.campaigns.update_one(
        {"id": campaign_id, "user_id": current_user["id"], "status": "running"},
        {"$set": {"status": "paused"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found or not running")
    return {"message": "Campaign paused"}

@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.campaigns.delete_one({"id": campaign_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.messages.delete_many({"campaign_id": campaign_id})
    return {"message": "Campaign deleted"}

# ==================== ANALYTICS ROUTES ====================

@api_router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    
    # Accounts stats
    total_accounts = await db.telegram_accounts.count_documents({"user_id": user_id})
    active_accounts = await db.telegram_accounts.count_documents({"user_id": user_id, "status": "active"})
    banned_accounts = await db.telegram_accounts.count_documents({"user_id": user_id, "status": "banned"})
    
    # Contacts stats
    total_contacts = await db.contacts.count_documents({"user_id": user_id})
    messaged_contacts = await db.contacts.count_documents({"user_id": user_id, "status": "messaged"})
    responded_contacts = await db.contacts.count_documents({"user_id": user_id, "status": "responded"})
    
    # Campaigns stats
    total_campaigns = await db.campaigns.count_documents({"user_id": user_id})
    running_campaigns = await db.campaigns.count_documents({"user_id": user_id, "status": "running"})
    
    # Messages stats
    pipeline = [
        {"$lookup": {"from": "campaigns", "localField": "campaign_id", "foreignField": "id", "as": "campaign"}},
        {"$match": {"campaign.user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_sent": {"$sum": 1},
            "total_delivered": {"$sum": {"$cond": [{"$eq": ["$status", "delivered"]}, 1, 0]}},
            "total_responses": {"$sum": {"$cond": [{"$eq": ["$status", "responded"]}, 1, 0]}}
        }}
    ]
    
    msg_stats = await db.messages.aggregate(pipeline).to_list(1)
    total_messages_sent = msg_stats[0]["total_sent"] if msg_stats else 0
    total_messages_delivered = msg_stats[0]["total_delivered"] if msg_stats else 0
    total_responses = msg_stats[0]["total_responses"] if msg_stats else 0
    
    # Campaign aggregates for responses
    campaign_stats = await db.campaigns.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_sent": {"$sum": "$messages_sent"},
            "total_delivered": {"$sum": "$messages_delivered"},
            "total_responses": {"$sum": "$responses_count"}
        }}
    ]).to_list(1)
    
    if campaign_stats:
        total_messages_sent = campaign_stats[0].get("total_sent", 0)
        total_messages_delivered = campaign_stats[0].get("total_delivered", 0)
        total_responses = campaign_stats[0].get("total_responses", 0)
    
    delivery_rate = (total_messages_delivered / total_messages_sent * 100) if total_messages_sent > 0 else 0
    response_rate = (total_responses / total_messages_delivered * 100) if total_messages_delivered > 0 else 0
    
    # Daily stats (last 7 days simulated)
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

@api_router.get("/analytics/messages")
async def get_messages_analytics(
    campaign_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if campaign_id:
        campaign = await db.campaigns.find_one({"id": campaign_id, "user_id": current_user["id"]})
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        query["campaign_id"] = campaign_id
    
    messages = await db.messages.find(query, {"_id": 0}).to_list(1000)
    return messages

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Telegram Bot Manager API", "status": "ok"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include router and configure app
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
