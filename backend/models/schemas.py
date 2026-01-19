"""
Pydantic models for request/response validation
"""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional


# ==================== AUTH MODELS ====================

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


# ==================== ACCOUNT MODELS ====================

class ProxyConfig(BaseModel):
    enabled: bool = False
    type: str = "socks5"
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
    value_usdt: Optional[float] = 0


class TelegramAccountResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    phone: str
    name: Optional[str]
    status: str
    proxy: Optional[dict]
    limits: Optional[dict]
    value_usdt: float
    price_category: str
    messages_sent_today: int
    messages_sent_hour: int
    total_messages_sent: int
    total_messages_delivered: int
    created_at: str
    last_active: Optional[str]


# ==================== CONTACT MODELS ====================

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


# ==================== CAMPAIGN MODELS ====================

class CampaignCreate(BaseModel):
    name: str
    message_template: str
    account_ids: Optional[List[str]] = []
    account_categories: Optional[List[str]] = []
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
    account_categories: Optional[List[str]]
    total_contacts: int
    messages_sent: int
    messages_delivered: int
    messages_failed: int
    responses_count: int
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]


# ==================== DIALOG MODELS ====================

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


# ==================== TEMPLATE MODELS ====================

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


# ==================== VOICE MESSAGE MODELS ====================

class VoiceMessageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    delay_minutes: int = 30


class VoiceMessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: Optional[str]
    filename: str
    duration: Optional[float]
    delay_minutes: int
    is_active: bool
    sent_count: int
    created_at: str


# ==================== FOLLOW-UP MODELS ====================

class FollowUpQueueResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: str
    contact_phone: str
    contact_name: Optional[str]
    status: str
    read_at: str
    scheduled_at: str
    voice_message_id: Optional[str]
    voice_message_name: Optional[str]


# ==================== ANALYTICS MODELS ====================

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
