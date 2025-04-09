#!/usr/bin/env python3

import os
import json
import time
from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import openai
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Required environment variables
required_env_vars = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_REDIRECT_URI',
    'OPENAI_API_KEY',
    'FRONTEND_URL',
    'BACKEND_URL'
]

# Check for required environment variables
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Configure environment variables
os.environ['SPOTIFY_REDIRECT_URI'] = os.getenv('SPOTIFY_REDIRECT_URI')
os.environ['SPOTIFY_CLIENT_ID'] = os.getenv('SPOTIFY_CLIENT_ID')
os.environ['SPOTIFY_CLIENT_SECRET'] = os.getenv('SPOTIFY_CLIENT_SECRET')
os.environ['FRONTEND_URL'] = os.getenv('FRONTEND_URL')
os.environ['BACKEND_URL'] = os.getenv('BACKEND_URL')
os.environ['PORT'] = os.getenv('PORT', '3001')
os.environ['HOST'] = os.getenv('HOST', '0.0.0.0')

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Required for session handling

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],  # Allow all origins during development
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Origin", "Accept"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type", "Authorization"]
    }
})

# Add error handler for CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Configure for environment
is_production = os.getenv('ENVIRONMENT') == 'production'
app.config['PREFERRED_URL_SCHEME'] = 'https' if is_production else 'http'
app.config['SESSION_COOKIE_SECURE'] = is_production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax' if is_production else None

# Configure logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Spotify OAuth
sp_oauth = SpotifyOAuth(
    client_id=os.getenv('SPOTIFY_CLIENT_ID'),
    client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
    redirect_uri=os.getenv('SPOTIFY_REDIRECT_URI'),
    scope='playlist-modify-public playlist-modify-private user-read-private user-read-email',
    show_dialog=True
)

def get_spotify_client():
    """Get a Spotify client with a valid token"""
    token_info = session.get('token_info', None)
    
    if not token_info:
        raise Exception('No token found in session')
    
    # Check if token is expired
    now = int(time.time())
    is_expired = token_info['expires_at'] - now < 60  # Refresh if less than 60 seconds left
    
    if is_expired:
        logger.info('Token expired, refreshing...')
        token_info = sp_oauth.refresh_access_token(token_info['refresh_token'])
        session['token_info'] = token_info
    
    return spotipy.Spotify(auth=token_info['access_token'])

@app.route('/api/login')
def login():
    try:
        auth_url = sp_oauth.get_authorize_url()
        logger.info(f"Generated Spotify auth URL: {auth_url}")
        return jsonify({'auth_url': auth_url})
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
            return redirect(f"{os.getenv('FRONTEND_URL')}/auth?error=no_code")
            
        token_info = sp_oauth.get_access_token(code)
        if not token_info:
            logger.error('Failed to get access token')
            return redirect(f"{os.getenv('FRONTEND_URL')}/auth?error=token_failed")
        
        # Add expiration time to token info
        token_info['expires_at'] = int(time.time()) + token_info['expires_in']
        session['token_info'] = token_info
        
        logger.info('Successfully authenticated with Spotify')
        return redirect(f"{os.getenv('FRONTEND_URL')}/auth?from=spotify")
        
    except Exception as e:
        logger.error(f'Error in callback: {str(e)}')
        return redirect(f"{os.getenv('FRONTEND_URL')}/auth?error=callback_failed")

@app.route('/api/check-auth')
def check_auth():
    try:
        token_info = session.get('token_info', None)
        if not token_info:
            return jsonify({'authenticated': False})
        
        # Check if token is expired
        now = int(time.time())
        is_expired = token_info['expires_at'] - now < 60
        
        if is_expired:
            try:
                token_info = sp_oauth.refresh_access_token(token_info['refresh_token'])
                token_info['expires_at'] = int(time.time()) + token_info['expires_in']
                session['token_info'] = token_info
            except Exception as e:
                logger.error(f'Error refreshing token: {e}')
                return jsonify({'authenticated': False})
        
        # Verify token is valid by making a simple API call
        sp = spotipy.Spotify(auth=token_info['access_token'])
        sp.current_user()
        return jsonify({'authenticated': True})
    except Exception as e:
        logger.error(f'Auth check error: {e}')
        return jsonify({'authenticated': False})

@app.route('/api/me')
def get_me():
    try:
        sp = get_spotify_client()
        user = retry_with_backoff(lambda: sp.current_user())
        return jsonify(user)
    except Exception as e:
        logger.error(f'Error getting user profile: {e}')
        return jsonify({'error': 'Failed to get user profile', 'details': str(e)}), 500

@app.route('/api/create-playlist', methods=['POST'])
def create_playlist():
    try:
        sp = get_spotify_client()
        data = request.json
        mood = data['mood']
        genres = data['genres']
        playlist_name = data['playlistName']

        # Get song suggestions from GPT
        openai.api_key = os.getenv('OPENAI_API_KEY')
        completion = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are a music expert. Suggest 10 specific songs (with artists) that would fit the given mood and genres. Format the response as JSON with fields: songSuggestions (array of {title, artist}), description (string explaining the selection)."
                },
                {
                    "role": "user",
                    "content": f"Suggest songs for a {mood} playlist with these genres: {', '.join(genres)}"
                }
            ]
        )
        
        suggestions = json.loads(completion.choices[0].message['content'])
        logger.info('Got song suggestions')
        logger.debug(f'Suggestions: {suggestions}')

        # Create playlist
        user_id = retry_with_backoff(lambda: sp.current_user()['id'])
        playlist = retry_with_backoff(lambda: sp.user_playlist_create(
            user_id,
            playlist_name,
            public=False,
            description=f"A playlist created based on {mood} mood and {', '.join(genres)} genres"
        ))

        # Search and add tracks
        added_tracks = []
        for song in suggestions['songSuggestions']:
            try:
                query = f"{song['artist']} {song['title']}"
                results = retry_with_backoff(lambda: sp.search(q=query, type='track', limit=1))
                
                if results['tracks']['items']:
                    track = results['tracks']['items'][0]
                    added_tracks.append(track)
                    logger.info(f"Found track: {track['name']} by {track['artists'][0]['name']}")
            except Exception as e:
                logger.warning(f"Error searching for track: {song['title']}, error: {e}")

        # Add tracks to playlist
        if added_tracks:
            track_uris = [track['uri'] for track in added_tracks]
            retry_with_backoff(lambda: sp.playlist_add_items(playlist['id'], track_uris))
            logger.info(f'Added {len(track_uris)} initial tracks to playlist')

            try:
                seed_tracks = [track['id'] for track in added_tracks[:2]]
                seed_params = {
                    'limit': 20,
                    'seed_tracks': ','.join(seed_tracks),
                    'target_valence': 0.7 if mood.lower() == 'happy' else 0.3,
                    'target_energy': 0.8 if mood.lower() in ['happy', 'energetic'] else 0.4
                }
                recommendations = retry_with_backoff(lambda: sp._get('recommendations', params=seed_params))
                
                if recommendations and recommendations.get('tracks'):
                    rec_uris = [track['uri'] for track in recommendations['tracks']]
                    retry_with_backoff(lambda: sp.playlist_add_items(playlist['id'], rec_uris))
                    logger.info(f'Added {len(rec_uris)} recommended tracks to playlist')
                    added_tracks.extend(recommendations['tracks'])
            except Exception as e:
                logger.warning(f'Error getting recommendations: {str(e)}')
                logger.info('Continuing with initial tracks only')

            return jsonify({
                'playlistId': playlist['id'],
                'playlistUrl': playlist['external_urls']['spotify'],
                'trackCount': len(added_tracks),
                'preview': {
                    'suggestedTracks': [{
                        'name': track['name'],
                        'artist': track['artists'][0]['name'],
                        'image': track['album']['images'][0]['url'] if track['album']['images'] else None
                    } for track in added_tracks[:10]],
                    'description': suggestions['description']
                }
            })
        else:
            raise Exception('No tracks found to add to playlist')

    except Exception as e:
        logger.error(f'Error creating playlist: {e}')
        return jsonify({'error': 'Failed to create playlist', 'details': str(e)}), 500

def retry_with_backoff(func, max_retries=3, initial_delay=1):
    """Retry a function with exponential backoff"""
    delay = initial_delay
    last_exception = None

    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            last_exception = e
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
    
    raise last_exception

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '3001'))
    app.run(host=host, port=port) 