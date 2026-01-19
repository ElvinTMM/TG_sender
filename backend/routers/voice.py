"""
Voice messages routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os
import shutil

from config import db, UPLOAD_DIR
from models.schemas import VoiceMessageResponse
from services.auth_service import get_current_user

router = APIRouter(prefix="/voice-messages", tags=["voice"])


@router.get("", response_model=List[VoiceMessageResponse])
async def get_voice_messages(current_user: dict = Depends(get_current_user)):
    messages = await db.voice_messages.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return [VoiceMessageResponse(**m) for m in messages]


@router.post("")
async def upload_voice_message(
    name: str,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    delay_minutes: int = 30,
    current_user: dict = Depends(get_current_user)
):
    # Validate file type
    allowed_types = ['.mp3', '.ogg', '.wav', '.m4a']
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Use: {', '.join(allowed_types)}")
    
    voice_id = str(uuid.uuid4())
    filename = f"{voice_id}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Get duration (simplified)
    file_size = os.path.getsize(file_path)
    estimated_duration = file_size / 16000
    
    voice_doc = {
        "id": voice_id,
        "user_id": current_user["id"],
        "name": name,
        "description": description,
        "filename": filename,
        "duration": round(estimated_duration, 1),
        "delay_minutes": delay_minutes,
        "is_active": True,
        "sent_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.voice_messages.insert_one(voice_doc)
    
    return VoiceMessageResponse(**{k: v for k, v in voice_doc.items() if k != "user_id"})


@router.get("/{voice_id}/file")
async def get_voice_file(voice_id: str, current_user: dict = Depends(get_current_user)):
    voice = await db.voice_messages.find_one({"id": voice_id, "user_id": current_user["id"]})
    if not voice:
        raise HTTPException(status_code=404, detail="Voice message not found")
    
    file_path = UPLOAD_DIR / voice["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)


@router.put("/{voice_id}/toggle")
async def toggle_voice_message(voice_id: str, current_user: dict = Depends(get_current_user)):
    voice = await db.voice_messages.find_one({"id": voice_id, "user_id": current_user["id"]})
    if not voice:
        raise HTTPException(status_code=404, detail="Voice message not found")
    
    new_status = not voice.get("is_active", True)
    await db.voice_messages.update_one(
        {"id": voice_id},
        {"$set": {"is_active": new_status}}
    )
    return {"message": "Status updated", "is_active": new_status}


@router.delete("/{voice_id}")
async def delete_voice_message(voice_id: str, current_user: dict = Depends(get_current_user)):
    voice = await db.voice_messages.find_one({"id": voice_id, "user_id": current_user["id"]})
    if not voice:
        raise HTTPException(status_code=404, detail="Voice message not found")
    
    # Delete file
    file_path = UPLOAD_DIR / voice["filename"]
    if file_path.exists():
        os.remove(file_path)
    
    await db.voice_messages.delete_one({"id": voice_id})
    return {"message": "Voice message deleted"}
