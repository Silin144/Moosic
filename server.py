#!/usr/bin/env python3

import os
import json
import time
from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS
from flask_session import Session
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import openai
from dotenv import load_dotenv
import requests
import secrets

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
os.environ['PORT'] = '3001'  # Force port 3001
os.environ['HOST'] = os.getenv('HOST', '0.0.0.0')

# SSL certificate paths
ssl_context = (
    '/opt/moosic/ssl/fullchain.pem',  # Certificate path
    '/opt/moosic/ssl/privkey.pem'     # Private key path
)

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'some_random_key')

# Configure logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure session
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_DOMAIN'] = None
app.config['PERMANENT_SESSION_LIFETIME'] = 3600
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_NAME'] = 'moosic_session'
app.config['SESSION_REFRESH_EACH_REQUEST'] = True
app.config['SESSION_FILE_DIR'] = '/tmp/flask_session'  # Add this line for filesystem session storage

# Initialize Flask-Session
Session(app)

# Configure CORS with more permissive settings
CORS(app, resources={
    r"/api/*": {
        "origins": [os.environ['FRONTEND_URL']],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type", "Authorization", "Set-Cookie"],
        "allow_credentials": True,
        "max_age": 3600
    }
})

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', os.environ['FRONTEND_URL'])
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Expose-Headers', 'Set-Cookie')
    response.headers.add('Access-Control-Max-Age', '3600')
    return response

# Configure for environment
is_production = os.getenv('ENVIRONMENT') == 'production'
app.config['PREFERRED_URL_SCHEME'] = 'https'

# Initialize Spotify OAuth with state parameter
sp_oauth = SpotifyOAuth(
    client_id=os.getenv('SPOTIFY_CLIENT_ID'),
    client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
    redirect_uri=os.getenv('SPOTIFY_REDIRECT_URI'),
    scope='playlist-modify-public playlist-modify-private user-read-private user-read-email',
    state='moosic_state',  # Add state parameter for security
    show_dialog=True  # Force user to approve the app each time
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
        try:
            logger.info('Token expired, refreshing...')
            token_info = sp_oauth.refresh_access_token(token_info['refresh_token'])
            session['token_info'] = token_info
            session.modified = True
        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
            session.clear()
            raise Exception('Failed to refresh token')
    
    return spotipy.Spotify(auth=token_info['access_token'])

@app.route('/api/login')
def login():
    try:
        # Get PKCE parameters from request
        code_challenge = request.args.get('code_challenge')
        code_challenge_method = request.args.get('code_challenge_method')
        
        if not code_challenge or code_challenge_method != 'S256':
            logger.error("Missing or invalid PKCE parameters")
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Invalid%20PKCE%20parameters")
        
        # Generate a unique state parameter
        state = secrets.token_urlsafe(16)
        session['oauth_state'] = state
        session.modified = True  # Force session to be saved
        
        # Get authorization URL with PKCE parameters
        auth_url = sp_oauth.get_authorize_url(
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method
        )
        return redirect(auth_url)
    except Exception as e:
        logger.error(f"Error in login route: {str(e)}")
        return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20initialize%20login")

@app.route('/api/callback', methods=['GET', 'POST'])
def callback():
    if request.method == 'POST':
        data = request.get_json()
        code = data.get('code')
        code_verifier = data.get('code_verifier')
    else:
        code = request.args.get('code')
        code_verifier = request.args.get('code_verifier')
    
    error = request.args.get('error')
    
    if error:
        logger.error(f"Spotify auth error: {error}")
        return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message={error}")
    
    if not code:
        logger.error("No authorization code received")
        return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=No%20authorization%20code%20received")

    if not code_verifier:
        logger.error("No code verifier provided")
        return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=No%20code%20verifier%20provided")

    try:
        # Exchange code for tokens using spotipy with PKCE
        token_info = sp_oauth.get_access_token(
            code,
            as_dict=False,
            check_cache=False,
            code_verifier=code_verifier
        )
        
        if not token_info:
            logger.error("Failed to get access token")
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20get%20access%20token")
        
        # Store token info in session
        session['token_info'] = {
            'access_token': token_info['access_token'],
            'refresh_token': token_info['refresh_token'],
            'expires_at': int(time.time()) + token_info['expires_in']
        }
        
        # Get user info using spotipy
        sp = spotipy.Spotify(auth=token_info['access_token'])
        user_info = sp.current_user()
        
        if not user_info:
            logger.error("Failed to get user info")
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20get%20user%20info")
        
        session['user'] = {
            'id': user_info.get('id'),
            'name': user_info.get('display_name'),
            'email': user_info.get('email'),
            'image': user_info.get('images', [{}])[0].get('url') if user_info.get('images') else None
        }

        # Force session to be saved
        session.modified = True
        
        # Log successful authentication
        logger.info(f"User {user_info.get('id')} authenticated successfully")
        
        if request.method == 'POST':
            return jsonify({"status": "success"})
        return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=success")

    except Exception as e:
        logger.error(f"Error in callback: {str(e)}")
        if request.method == 'POST':
            return jsonify({"status": "error", "message": str(e)}), 400
        return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=An%20error%20occurred%20during%20authentication")

@app.route('/api/check-auth')
def check_auth():
    try:
        logger.info(f"Checking auth, session keys: {list(session.keys())}")
        if 'token_info' in session and 'user' in session:
            # Check if token is expired
            if time.time() > session['token_info']['expires_at']:
                try:
                    # Refresh the token
                    token_url = 'https://accounts.spotify.com/api/token'
                    response = requests.post(
                        token_url,
                        data={
                            'grant_type': 'refresh_token',
                            'refresh_token': session['token_info']['refresh_token'],
                            'client_id': os.environ['SPOTIFY_CLIENT_ID'],
                            'client_secret': os.environ['SPOTIFY_CLIENT_SECRET']
                        },
                        headers={
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    )
                    
                    if response.status_code == 200:
                        token_data = response.json()
                        session['token_info'] = {
                            'access_token': token_data['access_token'],
                            'refresh_token': session['token_info']['refresh_token'],
                            'expires_at': int(time.time()) + token_data['expires_in']
                        }
                        session.modified = True
                    else:
                        logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                        session.clear()
                        return jsonify({"authenticated": False})
                except Exception as e:
                    logger.error(f"Error refreshing token: {str(e)}")
                    session.clear()
                    return jsonify({"authenticated": False})
            
            return jsonify({
                "authenticated": True,
                "user": session['user']
            })
        
        logger.warning(f"No valid session found. Session keys: {list(session.keys())}")
        return jsonify({"authenticated": False})
    except Exception as e:
        logger.error(f"Error in check-auth: {str(e)}")
        return jsonify({"authenticated": False})

@app.route('/api/logout')
def logout():
    session.clear()
    return redirect(f"{os.environ['FRONTEND_URL']}/auth")

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

@app.route('/api/generate-playlist', methods=['POST'])
def generate_playlist():
    try:
        # Check authentication
        if 'token_info' not in session or 'user' not in session:
            return jsonify({"error": "User not authenticated"}), 401

        data = request.json
        playlist_description = data.get('description', '')
        
        if not playlist_description:
            return jsonify({"error": "Playlist description is required"}), 400

        # Get Spotify client with valid token
        sp = get_spotify_client()
        
        # Generate song suggestions using OpenAI
        try:
            prompt = f"Generate a list of 10 songs for this playlist idea:\n{playlist_description}\n\nFormat each song as 'Song Name by Artist'"
            openai_response = openai.Completion.create(
                model="gpt-3.5-turbo-instruct",
                prompt=prompt,
                max_tokens=150
            )
            
            song_list = [line.strip() for line in openai_response.choices[0].text.strip().split('\n') if line.strip()]
            
            # Search for tracks on Spotify
            track_uris = []
            tracks = []
            
            for song in song_list:
                search_url = "https://api.spotify.com/v1/search"
                headers = {"Authorization": f"Bearer {session['token_info']['access_token']}"}
                params = {"q": song, "type": "track", "limit": 1}
                
                res = requests.get(search_url, headers=headers, params=params)
                if res.status_code == 200:
                    search_results = res.json()
                    items = search_results.get('tracks', {}).get('items', [])
                    if items:
                        track = items[0]
                        track_uris.append(track['uri'])
                        tracks.append({
                            'name': track['name'],
                            'artist': track['artists'][0]['name'],
                            'album_image': track['album']['images'][0]['url'] if track['album']['images'] else None
                        })

            # Create playlist
            create_playlist_url = f"https://api.spotify.com/v1/users/{session['user']['id']}/playlists"
            payload = {
                "name": f"AI Generated: {playlist_description[:30]}...",
                "description": f"Generated by Moosic AI based on: {playlist_description}",
                "public": False
            }
            
            create_res = requests.post(
                create_playlist_url,
                headers={"Authorization": f"Bearer {session['token_info']['access_token']}"},
                json=payload
            )
            
            if create_res.status_code != 201:
                logger.error(f"Failed to create playlist: {create_res.status_code} - {create_res.text}")
                return jsonify({"error": "Failed to create playlist"}), 400
                
            playlist_data = create_res.json()
            playlist_id = playlist_data['id']

            # Add tracks to playlist
            add_tracks_url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
            add_payload = {"uris": track_uris}
            
            add_res = requests.post(
                add_tracks_url,
                headers={"Authorization": f"Bearer {session['token_info']['access_token']}"},
                json=add_payload
            )
            
            if add_res.status_code != 201:
                logger.error(f"Failed to add tracks: {add_res.status_code} - {add_res.text}")
                return jsonify({"error": "Failed to add tracks to playlist"}), 400

            return jsonify({
                "success": True,
                "playlist_url": playlist_data['external_urls']['spotify'],
                "playlist_name": playlist_data['name'],
                "tracks": tracks
            })

        except Exception as e:
            logger.error(f"Error in playlist generation: {str(e)}")
            return jsonify({"error": str(e)}), 500

    except Exception as e:
        logger.error(f"Error in generate-playlist route: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

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
    port = int(os.getenv('PORT', 10000))
    app.run(host='0.0.0.0', port=port) 