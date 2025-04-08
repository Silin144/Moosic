import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Spotify Configuration
SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI', 'https://moosic-liart.vercel.app//api/callback')

# OpenAI Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Server Configuration
SERVER_PORT = int(os.getenv('PORT', '3001'))
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://moosic-liart.vercel.app/')

# CORS Configuration
CORS_ORIGINS = [
    FRONTEND_URL,
    'https://moosic-liart.vercel.app/',  # For local development
]

# Check required environment variables
required_vars = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'OPENAI_API_KEY'
]

missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
