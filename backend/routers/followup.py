"""
Follow-up queue routes - handles "read but not replied" logic
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from config import db
from models.schemas import FollowUpQueueResponse
from services.auth_service import get_current_user
from services.followup_service import (
    add_to_followup_queue,
    process_followup_queue,
    get_followup_stats
)

router = APIRouter(prefix="/followup-queue", tags=["followup"])


@router.get("", response_model=List[FollowUpQueueResponse])
async def get_queue(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if status:
        query["status"] = status
    
    queue = await db.followup_queue.find(query, {"_id": 0}).sort("scheduled_at", 1).to_list(500)
    return [FollowUpQueueResponse(**q) for q in queue]


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get follow-up queue statistics"""
    return await get_followup_stats(current_user["id"])


@router.post("/add-read-contacts")
async def add_read_contacts(
    voice_message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add all contacts with 'read' status to follow-up queue"""
    voice = await db.voice_messages.find_one({"id": voice_message_id, "user_id": current_user["id"]})
    if not voice:
        raise HTTPException(status_code=404, detail="Voice message not found")
    
    result = await add_to_followup_queue(current_user["id"], voice_message_id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "message": f"Added {result['added']} contacts to queue",
        "added": result["added"],
        "already_in_queue": result["already_in_queue"],
        "total_read_contacts": result["total_read_contacts"]
    }


@router.post("/process")
async def process_queue(current_user: dict = Depends(get_current_user)):
    """Process pending follow-ups (send voice messages) - manual trigger"""
    result = await process_followup_queue(current_user["id"])
    return result


@router.delete("/{queue_id}")
async def cancel_followup(queue_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a pending follow-up"""
    result = await db.followup_queue.update_one(
        {"id": queue_id, "user_id": current_user["id"], "status": "pending"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found or already processed")
    return {"message": "Cancelled"}


@router.delete("")
async def clear_queue(current_user: dict = Depends(get_current_user)):
    """Clear completed/failed/cancelled items from queue"""
    result = await db.followup_queue.delete_many({
        "user_id": current_user["id"],
        "status": {"$in": ["sent", "cancelled", "failed"]}
    })
    return {"message": f"Cleared {result.deleted_count} items"}
