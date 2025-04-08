# MakeMeAPlaylist

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

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/makemeaplaylist.git
cd makemeaplaylist
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

## Development

Start the development servers:
```bash
./start.sh
```

This will start:
- Frontend at http://localhost:5173
- Backend at http://localhost:3001

## Production Deployment

1. Build the frontend:
```bash
npm run build
```

2. Set up your production environment variables:
```bash
SPOTIFY_REDIRECT_URI=https://your-domain.com/api/callback
FRONTEND_URL=https://your-domain.com
```

3. Deploy the backend:
- Use a production WSGI server (e.g., Gunicorn)
- Set up HTTPS
- Configure your web server (e.g., Nginx)

Example Gunicorn command:
```bash
gunicorn server:app -b 0.0.0.0:$PORT
```

4. Deploy the frontend build directory to your static hosting service

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
