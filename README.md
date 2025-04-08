# Moosic - AI-Powered Spotify Playlist Generator

A web application that creates personalized Spotify playlists using AI. The app combines GPT-4's music knowledge with Spotify's recommendation engine to create the perfect playlist based on your mood and genre preferences.

## Features

- Create playlists based on mood and genres
- AI-powered song suggestions using GPT-4
- Spotify recommendations integration
- Beautiful, modern UI with Tailwind CSS
- Real-time playlist preview
- Automatic playlist creation in your Spotify account

## Prerequisites

- Node.js 16+ and npm
- Python 3.9+
- A Spotify Developer account
- An OpenAI API key

## Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/Silin144/Moosic.git
cd Moosic
```

2. Install frontend dependencies:
```bash
npm install
```

3. Create a Python virtual environment and install backend dependencies:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
```

5. Configure your environment variables in `.env`:
- Get Spotify credentials from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- Get OpenAI API key from [OpenAI Platform](https://platform.openai.com/account/api-keys)

## Running the Application

You can run the frontend and backend separately:

### Frontend Only
```bash
# In one terminal
./start-frontend.sh
```
Frontend will run at http://localhost:5173

### Backend Only
```bash
# In another terminal
./start-backend.sh
```
Backend will run at http://localhost:3001

### Both Services
```bash
# Run both services together
./start.sh
```

## Production Deployment

### Frontend Deployment (Vercel)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel:
```
VITE_API_URL=https://your-backend-domain.com
```
4. Deploy with Vercel CLI:
```bash
npm install -g vercel
vercel
```

### Backend Deployment (Heroku)

1. Create Procfile:
```
web: gunicorn server:app
```

2. Install production dependencies:
```bash
pip install gunicorn
pip freeze > requirements.txt
```

3. Create Heroku app and deploy:
```bash
heroku create your-app-name
heroku git:remote -a your-app-name
git push heroku main
```

4. Set environment variables in Heroku:
```bash
heroku config:set SPOTIFY_CLIENT_ID=your_id
heroku config:set SPOTIFY_CLIENT_SECRET=your_secret
heroku config:set SPOTIFY_REDIRECT_URI=https://your-frontend-domain.com/api/callback
heroku config:set OPENAI_API_KEY=your_key
heroku config:set FRONTEND_URL=https://your-frontend-domain.com
```

### Important Deployment Steps

1. Update Spotify Developer Dashboard:
   - Add your production redirect URI
   - Update allowed origins

2. Update CORS settings in server.py:
   - Add your production frontend URL
   - Remove development URLs in production

3. Test the deployment:
   - Verify frontend can connect to backend
   - Test Spotify authentication flow
   - Ensure playlist creation works

## Tech Stack

- Frontend:
  - React with TypeScript
  - Tailwind CSS
  - shadcn/ui components
  - React Query
  - React Router

- Backend:
  - Python
  - Flask
  - Spotipy (Spotify API)
  - OpenAI API

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
