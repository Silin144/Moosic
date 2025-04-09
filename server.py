#!/usr/bin/env python3

import os
import json
import time
from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import openai

# Set environment variables
os.environ['SPOTIFY_REDIRECT_URI'] = 'https://moosic-liart.vercel.app/api/callback'
os.environ['SPOTIFY_CLIENT_ID'] = 'd5d0c24877cb45e58f67a8e95c711f10'
os.environ['SPOTIFY_CLIENT_SECRET'] = 'a3b14b591f7d407890076f0a7e91110c'
os.environ['FRONTEND_URL'] = 'https://moosic-liart.vercel.app'
os.environ['BACKEND_URL'] = 'http://3.148.173.124:3001'
os.environ['PORT'] = '3001'

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Required for session handling

# Import configuration
from config import (
    FRONTEND_URL,
    BACKEND_URL,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REDIRECT_URI,
    OPENAI_API_KEY,
    CORS_ORIGINS,
    IS_PRODUCTION,
    SERVER_PORT
)

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": CORS_ORIGINS + ['https://moosic-liart.vercel.app', 'https://*.vercel.app'],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Origin", "Accept"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type", "Authorization"]
    }
})

# Configure for environment
app.config['PREFERRED_URL_SCHEME'] = 'https' if IS_PRODUCTION else 'http'
app.config['SESSION_COOKIE_SECURE'] = IS_PRODUCTION
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax' if IS_PRODUCTION else None  # Allow cookies in development

# Configure logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Spotify OAuth
sp_oauth = SpotifyOAuth(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET,
    redirect_uri=SPOTIFY_REDIRECT_URI,
    scope='playlist-modify-public playlist-modify-private user-read-private user-read-email',
    show_dialog=True  # Force the consent dialog to show
)

# Initialize Spotify client
sp = spotipy.Spotify(auth_manager=sp_oauth)

@app.route('/api/login')
def login():
    try:
        # Create the auth URL with state parameter for security
        auth_url = sp_oauth.get_authorize_url()
        logger.info(f"Redirecting to Spotify auth URL: {auth_url}")
        return redirect(auth_url)
    except Exception as e:
        logger.error(f"Error in login: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/callback')
def callback():
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        
        if not code:
            logger.error('No code received in callback')
            return redirect(f'{FRONTEND_URL}/auth?error=no_code')
            
        # Get token info
        token_info = sp_oauth.get_access_token(code)
        if not token_info:
            logger.error('Failed to get access token')
            return redirect(f'{FRONTEND_URL}/auth?error=token_failed')
        
        # Store token info in session
        session['token_info'] = token_info
        
        logger.info('Successfully authenticated with Spotify')
        return redirect(f'{FRONTEND_URL}/auth?from=spotify')
        
    except Exception as e:
        logger.error(f'Error in callback: {str(e)}')
        return redirect(f'{FRONTEND_URL}/auth?error=callback_failed')

@app.route('/api/generate', methods=['POST'])
def generate_playlist():
    try:
        # Check if user is authenticated
        if 'token_info' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
            
        # Get the prompt from the request
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({'error': 'No prompt provided'}), 400
            
        prompt = data['prompt']
        
        # Generate playlist using OpenAI
        openai.api_key = OPENAI_API_KEY
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a music playlist generator. Generate a list of 10 songs based on the user's prompt. For each song, provide the title and artist. Format the response as a JSON array of objects with 'title' and 'artist' fields."},
                {"role": "user", "content": prompt}
            ]
        )
        
        # Parse the response
        playlist = json.loads(response.choices[0].message.content)
        
        # Create playlist in Spotify
        sp = spotipy.Spotify(auth=session['token_info']['access_token'])
        user_id = sp.current_user()['id']
        
        # Create the playlist
        playlist_name = f"Generated Playlist: {prompt[:50]}..."
        playlist_description = f"Playlist generated based on: {prompt}"
        new_playlist = sp.user_playlist_create(
            user_id,
            playlist_name,
            public=True,
            description=playlist_description
        )
        
        # Search for and add tracks
        track_uris = []
        for song in playlist:
            results = sp.search(q=f"track:{song['title']} artist:{song['artist']}", type='track', limit=1)
            if results['tracks']['items']:
                track_uris.append(results['tracks']['items'][0]['uri'])
        
        if track_uris:
            sp.playlist_add_items(new_playlist['id'], track_uris)
        
        return jsonify({
            'playlist_url': new_playlist['external_urls']['spotify'],
            'playlist_id': new_playlist['id']
        })
        
    except Exception as e:
        logger.error(f'Error in generate_playlist: {str(e)}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=SERVER_PORT) 