"""
Templates routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
import uuid

from config import db
from models.schemas import TemplateCreate, TemplateResponse
from services.auth_service import get_current_user

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=List[TemplateResponse])
async def get_templates(current_user: dict = Depends(get_current_user)):
    templates = await db.templates.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return [TemplateResponse(**t) for t in templates]


@router.post("", response_model=TemplateResponse)
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


@router.put("/{template_id}", response_model=TemplateResponse)
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


@router.delete("/{template_id}")
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.templates.delete_one({"id": template_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}
