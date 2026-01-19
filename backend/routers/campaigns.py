"""
Campaigns routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
import uuid

from config import db
from models.schemas import CampaignCreate, CampaignResponse
from services.auth_service import get_current_user
from services.campaign_service import execute_campaign

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=List[CampaignResponse])
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    campaigns = await db.campaigns.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return [CampaignResponse(**c) for c in campaigns]


@router.post("", response_model=CampaignResponse)
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
        "account_ids": campaign.account_ids or [],
        "account_categories": campaign.account_categories or [],
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


@router.put("/{campaign_id}/start")
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
    
    # Execute campaign with smart rotation
    result = await execute_campaign(campaign, current_user["id"])
    
    if "error" in result:
        await db.campaigns.update_one(
            {"id": campaign_id},
            {"$set": {"status": "draft"}}
        )
        raise HTTPException(status_code=400, detail=result["error"])
    
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "completed",
            "messages_sent": result["sent"],
            "messages_delivered": result["delivered"],
            "messages_failed": result["failed"],
            "responses_count": result["responses"],
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Campaign completed",
        "sent": result["sent"],
        "delivered": result["delivered"],
        "failed": result["failed"],
        "responses": result["responses"],
        "skipped_due_to_limits": result.get("skipped_due_to_limits", 0),
        "accounts_used": result["accounts_used"],
        "by_category": result["by_category"]
    }


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.campaigns.delete_one({"id": campaign_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign deleted"}
