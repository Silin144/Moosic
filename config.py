import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Environment
IS_PRODUCTION = os.getenv('VERCEL_ENV') == 'production'

# URLs
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://moosic-liart.vercel.app' if IS_PRODUCTION else 'http://localhost:5173')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://3.148.173.124:3001' if IS_PRODUCTION else 'http://localhost:3001')

# Spotify Configuration
SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
# Use backend URL for callback
SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI', f'{BACKEND_URL}/api/callback')

# OpenAI Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Server Configuration
SERVER_PORT = int(os.getenv('PORT', '3001'))

# CORS Configuration
CORS_ORIGINS = [FRONTEND_URL]
if not IS_PRODUCTION:
    CORS_ORIGINS.extend(['http://localhost:5173', 'http://localhost:3001'])

# Check required environment variables
required_vars = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'OPENAI_API_KEY'
]

missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
