module.exports = {
  apps: [{
    name: 'moosic-backend',
    script: 'server.py',
    interpreter: 'venv/bin/python',
    env: {
      SPOTIFY_REDIRECT_URI: 'https://moosic-liart.vercel.app/api/callback',
      SPOTIFY_CLIENT_ID: 'd5d0c24877cb45e58f67a8e95c711f10',
      SPOTIFY_CLIENT_SECRET: 'a3b14b591f7d407890076f0a7e91110c',
      FRONTEND_URL: 'https://moosic-liart.vercel.app',
      BACKEND_URL: 'http://3.148.173.124:3001',
      PORT: '3001'
    }
  }]
} 