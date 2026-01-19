"""
TG Sender - Telegram Bot Manager API
Main application entry point
"""
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import logging

from config import CORS_ORIGINS, client

# Import routers
from routers import auth, accounts, contacts, campaigns, templates, dialogs, analytics, voice, followup, telegram

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="TG Sender API",
    description="Telegram Bot Manager for mass outreach campaigns",
    version="2.0.0"
)

# Include routers with /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(dialogs.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(followup.router, prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/")
async def root():
    return {"message": "TG Sender API v2.0", "status": "ok"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
