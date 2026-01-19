"""
Configuration and database connection
"""
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# Upload directories
UPLOAD_DIR = ROOT_DIR / "uploads" / "voice"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# CORS
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
