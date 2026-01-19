"""
Dialogs routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from config import db
from models.schemas import DialogResponse
from services.auth_service import get_current_user

router = APIRouter(prefix="/dialogs", tags=["dialogs"])


@router.get("", response_model=List[DialogResponse])
async def get_dialogs(has_response: Optional[bool] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if has_response is not None:
        query["has_response"] = has_response
    
    dialogs = await db.dialogs.find(query, {"_id": 0}).sort("last_message_at", -1).to_list(500)
    return [DialogResponse(**d) for d in dialogs]


@router.get("/{dialog_id}", response_model=DialogResponse)
async def get_dialog(dialog_id: str, current_user: dict = Depends(get_current_user)):
    dialog = await db.dialogs.find_one({"id": dialog_id, "user_id": current_user["id"]}, {"_id": 0})
    if not dialog:
        raise HTTPException(status_code=404, detail="Dialog not found")
    return DialogResponse(**dialog)


@router.post("/{dialog_id}/reply")
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
