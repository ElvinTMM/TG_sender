"""
TG Sender - Telegram Bot Manager API
This file imports from the refactored modular structure
"""
# Import the app from main.py for backward compatibility with supervisor config
from main import app

# Re-export for uvicorn
__all__ = ['app']
