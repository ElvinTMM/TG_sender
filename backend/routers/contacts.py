"""
Contacts routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import json
import pandas as pd
from io import BytesIO

from config import db
from models.schemas import ContactCreate, ContactResponse
from services.auth_service import get_current_user

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=List[ContactResponse])
async def get_contacts(tag: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if tag:
        query["tags"] = tag
    if status:
        query["status"] = status
    
    contacts = await db.contacts.find(query, {"_id": 0}).to_list(10000)
    return [ContactResponse(**c) for c in contacts]


@router.post("", response_model=ContactResponse)
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


@router.post("/import")
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


@router.post("/{contact_id}/mark-read")
async def mark_contact_read(contact_id: str, current_user: dict = Depends(get_current_user)):
    """Mark contact as read (for testing follow-up logic)"""
    result = await db.contacts.update_one(
        {"id": contact_id, "user_id": current_user["id"]},
        {"$set": {"status": "read", "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Marked as read"}


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.contacts.delete_one({"id": contact_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}


@router.delete("")
async def delete_all_contacts(current_user: dict = Depends(get_current_user)):
    result = await db.contacts.delete_many({"user_id": current_user["id"]})
    return {"message": f"Deleted {result.deleted_count} contacts"}
