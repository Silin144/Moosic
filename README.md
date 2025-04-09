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

### Backend Deployment (AWS EC2)

1. Launch an EC2 instance:
   - Use Ubuntu Server 22.04 LTS
   - Configure security groups to allow HTTP (80), HTTPS (443), and SSH (22)
   - Create and download your key pair

2. Set up the server:
```bash
# SSH into your instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Clone the repository
git clone https://github.com/Silin144/Moosic.git
cd Moosic

# Install dependencies
sudo apt-get update
sudo apt-get install -y python3-pip nodejs npm
sudo npm install -g pm2

# Set up Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
# Create .env file
echo "SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret
OPENAI_API_KEY=your_key
SPOTIFY_REDIRECT_URI=https://your-frontend-domain.com/api/callback
FRONTEND_URL=https://your-frontend-domain.com
BACKEND_URL=https://your-backend-domain.com" | sudo tee .env
```

4. Start the server with PM2:
```bash
# Start the server
pm2 start server.py --name moosic-backend

# Ensure PM2 starts on system reboot
pm2 startup
pm2 save
```

5. (Optional) Set up Nginx as a reverse proxy:
```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/moosic

# Add the following configuration:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

sudo ln -s /etc/nginx/sites-available/moosic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
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

4. Monitor the application:
```bash
# View PM2 status
pm2 status

# View logs
pm2 logs moosic-backend

# Monitor resources
pm2 monit
```

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
  - PM2 process manager

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
