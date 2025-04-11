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
import urllib.parse
import re

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
app.config['SESSION_COOKIE_SAMESITE'] = 'None'  # Must be 'None' for cross-site requests
app.config['SESSION_COOKIE_DOMAIN'] = None
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_NAME'] = 'moosic_session'
app.config['SESSION_REFRESH_EACH_REQUEST'] = True
app.config['SESSION_FILE_DIR'] = '/tmp/flask_session'
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_PERMANENT'] = True  # Make all sessions permanent by default

# Make sessions permanent by default
@app.before_request
def setup_session():
    session.permanent = True
    # Force the session to be saved immediately
    if request.path.startswith('/api/callback'):
        logger.info("Callback route detected, ensuring session persistence")

# Initialize Flask-Session
Session(app)

# Configure CORS
CORS(app, 
     origins=[os.environ['FRONTEND_URL']], 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "Accept"],
     methods=["GET", "POST", "OPTIONS"],
     expose_headers=["Content-Type", "Authorization", "Set-Cookie"]
)

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin', '')
    # Only apply CORS headers to requests from our frontend
    if origin == os.environ['FRONTEND_URL']:
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Expose-Headers', 'Set-Cookie')
        response.headers.add('Access-Control-Max-Age', '3600')
    
    # Log response cookies for debugging
    if 'Set-Cookie' in response.headers:
        logger.info(f"Setting cookies in response: {response.headers.getlist('Set-Cookie')}")
    
    # Set additional headers for SameSite=None to work properly
    if app.config['SESSION_COOKIE_SAMESITE'] == 'None' and app.config['SESSION_COOKIE_NAME'] in request.cookies:
        cookie = f"{app.config['SESSION_COOKIE_NAME']}={request.cookies[app.config['SESSION_COOKIE_NAME']]}; Path=/; SameSite=None; Secure; HttpOnly"
        response.headers.add('Set-Cookie', cookie)
        
    return response

# Configure for environment
is_production = os.getenv('ENVIRONMENT') == 'production'
app.config['PREFERRED_URL_SCHEME'] = 'https'

# Initialize Spotify OAuth with state parameter
sp_oauth = SpotifyOAuth(
    client_id=os.getenv('SPOTIFY_CLIENT_ID'),
    client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
    redirect_uri=os.getenv('SPOTIFY_REDIRECT_URI'),
    scope='playlist-modify-public playlist-modify-private user-read-private user-read-email user-top-read',
    state='moosic_state',  # Add state parameter for security
    show_dialog=True  # Force user to approve the app each time
)

def get_spotify_client():
    """Get a Spotify client with a valid token"""
    token_info = session.get('token_info', None)
    
    if not token_info:
        logger.error('No token found in session')
        logger.info(f"Available session keys: {list(session.keys())}")
        raise Exception('No token found in session')
    
    # Check if token is expired
    now = int(time.time())
    is_expired = token_info['expires_at'] - now < 60  # Refresh if less than 60 seconds left
    
    if is_expired:
        try:
            logger.info('Token expired, refreshing...')
            # Directly use requests instead of spotipy for token refresh
            refresh_token = token_info['refresh_token']
            token_url = 'https://accounts.spotify.com/api/token'
            response = requests.post(
                token_url,
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': refresh_token,
                    'client_id': os.environ['SPOTIFY_CLIENT_ID'],
                    'client_secret': os.environ['SPOTIFY_CLIENT_SECRET']
                },
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Error refreshing token: {response.status_code} - {response.text}")
                raise Exception('Failed to refresh token')
                
            new_token_info = response.json()
            token_info = {
                'access_token': new_token_info['access_token'],
                'refresh_token': refresh_token,  # Keep the existing refresh token if not provided
                'expires_at': int(time.time()) + new_token_info['expires_in']
            }
            session['token_info'] = token_info
            session.modified = True
            logger.info('Token refreshed successfully')
        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
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
        
        # Manually construct authorization URL with PKCE parameters
        auth_url = "https://accounts.spotify.com/authorize"
        params = {
            'client_id': os.getenv('SPOTIFY_CLIENT_ID'),
            'response_type': 'code',
            'redirect_uri': os.getenv('SPOTIFY_REDIRECT_URI'),
            'state': state,
            'scope': 'playlist-modify-public playlist-modify-private user-read-private user-read-email user-top-read',
            'code_challenge_method': code_challenge_method,
            'code_challenge': code_challenge,
            'show_dialog': 'true'  # Always show dialog for better user experience
        }
        
        auth_url = f"{auth_url}?{urllib.parse.urlencode(params)}"
        logger.info(f"Generated authorization URL: {auth_url[:100]}...")
        
        return redirect(auth_url)
    except Exception as e:
        logger.error(f"Error in login route: {str(e)}")
        return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20initialize%20login")

@app.route('/api/callback', methods=['GET', 'POST'])
def callback():
    try:
        if request.method == 'POST':
            # Log the content type and body for debugging
            logger.info(f"Received POST request with Content-Type: {request.headers.get('Content-Type')}")
            logger.info(f"Request body format: {type(request.data)}")
            
            # Handle different content types
            if request.is_json:
                data = request.json
                logger.info(f"Parsed JSON data: {data.keys() if data else 'None'}")
            else:
                # Try to parse JSON from raw data
                try:
                    data = json.loads(request.data.decode('utf-8'))
                    logger.info(f"Manually parsed JSON data: {data.keys() if data else 'None'}")
                except Exception as e:
                    logger.error(f"Failed to parse request body: {e}")
                    data = {}
            
            code = data.get('code')
            state = data.get('state')
            code_verifier = data.get('code_verifier')
            
            logger.info(f"POST params: code={code[:10] if code else None}..., state={state}, verifier={code_verifier[:10] if code_verifier else None}...")
        else:
            # For GET requests (initial Spotify redirect), just redirect to frontend
            code = request.args.get('code')
            state = request.args.get('state')
            logger.info(f"GET params: code={code[:10] if code else None}..., state={state}")
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?code={code}&state={state}")
        
        error = request.args.get('error')
        
        if error:
            logger.error(f"Spotify auth error: {error}")
            if request.method == 'POST':
                return jsonify({"status": "error", "message": error}), 400
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message={error}")
        
        if not code:
            logger.error("No authorization code received")
            if request.method == 'POST':
                return jsonify({"status": "error", "message": "No authorization code received"}), 400
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=No%20authorization%20code%20received")

        if not code_verifier and request.method == 'POST':
            logger.error("No code verifier received")
            return jsonify({"status": "error", "message": "No code verifier received"}), 400

        # Log the received code and state for debugging
        logger.info(f"Received code: {code[:10] if code else 'None'}...")
        logger.info(f"Received state: {state}")
        if code_verifier:
            logger.info(f"Received code_verifier: {code_verifier[:10]}...")

        # Clear any existing session first to prevent conflicts
        session.clear()
        
        # Exchange code for tokens using spotipy with PKCE
        try:
            # Manual token exchange using requests since SpotifyOAuth doesn't support PKCE
            logger.info("Performing manual token exchange with PKCE")
            token_url = 'https://accounts.spotify.com/api/token'
            payload = {
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': os.getenv('SPOTIFY_REDIRECT_URI'),
                'client_id': os.getenv('SPOTIFY_CLIENT_ID'),
                'code_verifier': code_verifier
            }
            
            response = requests.post(
                token_url,
                data=payload,
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            )
            
            if response.status_code != 200:
                error_msg = f"Token exchange failed: {response.status_code} - {response.text}"
                logger.error(error_msg)
                if request.method == 'POST':
                    return jsonify({"status": "error", "message": error_msg}), 400
                return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20get%20access%20token")
            
            token_info = response.json()
            logger.info("Successfully obtained token info")
        except Exception as e:
            logger.error(f"Error getting access token: {str(e)}")
            if request.method == 'POST':
                return jsonify({"status": "error", "message": f"Failed to get access token: {str(e)}"}), 400
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20get%20access%20token")
        
        if not token_info:
            logger.error("Token info is None")
            if request.method == 'POST':
                return jsonify({"status": "error", "message": "Failed to get access token"}), 400
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20get%20access%20token")
        
        # Store token info in session
        session['token_info'] = {
            'access_token': token_info['access_token'],
            'refresh_token': token_info['refresh_token'],
            'expires_at': int(time.time()) + token_info['expires_in']
        }
        
        # Get user info using spotipy
        try:
            sp = spotipy.Spotify(auth=token_info['access_token'])
            user_info = sp.current_user()
            logger.info(f"Successfully obtained user info for user: {user_info.get('id')}")
        except Exception as e:
            logger.error(f"Error getting user info: {str(e)}")
            if request.method == 'POST':
                return jsonify({"status": "error", "message": f"Failed to get user info: {str(e)}"}), 400
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20get%20user%20info")
        
        if not user_info:
            logger.error("User info is None")
            if request.method == 'POST':
                return jsonify({"status": "error", "message": "Failed to get user info"}), 400
            return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=Failed%20to%20get%20user%20info")
        
        session['user'] = {
            'id': user_info.get('id'),
            'name': user_info.get('display_name'),
            'email': user_info.get('email'),
            'image': user_info.get('images', [{}])[0].get('url') if user_info.get('images') else None
        }

        # Add key to verify session is valid
        session['authenticated'] = True
        
        # Force session to be saved
        session.modified = True
        
        # Log successful authentication
        logger.info(f"User {user_info.get('id')} authenticated successfully")
        logger.info(f"Session keys after auth: {list(session.keys())}")
        
        # Set a specific cookie to help with session persistence
        response = jsonify({"status": "success", "user": session['user']}) if request.method == 'POST' else redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=success")
        response.set_cookie(
            app.config['SESSION_COOKIE_NAME'],
            session.sid if hasattr(session, 'sid') else 'session-active',
            max_age=86400,  # 24 hours
            secure=True,
            httponly=True,
            samesite='None',
            path='/'
        )
        
        return response
    except Exception as e:
        logger.error(f"Unexpected error in callback: {str(e)}")
        if request.method == 'POST':
            return jsonify({"status": "error", "message": str(e)}), 500
        return redirect(f"{os.environ['FRONTEND_URL']}/auth?auth=error&message=An%20error%20occurred%20during%20authentication")

@app.route('/api/check-auth')
def check_auth():
    try:
        logger.info(f"Checking auth, session keys: {list(session.keys())}")
        logger.info(f"Session cookie name: {app.config['SESSION_COOKIE_NAME']}")
        logger.info(f"Session ID: {session.sid if hasattr(session, 'sid') else 'No session ID'}")
        
        # First, check if we have the authenticated flag and user data
        if 'authenticated' in session and 'user' in session and 'token_info' in session:
            logger.info("Found authenticated flag and user in session")
            
            # Check if token is expired
            if time.time() > session['token_info']['expires_at']:
                logger.info("Token is expired, attempting to refresh")
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
                        logger.info("Successfully refreshed token")
                        
                        # Update session cookie 
                        resp = jsonify({"authenticated": True, "user": session['user']})
                        resp.set_cookie(
                            app.config['SESSION_COOKIE_NAME'],
                            session.sid if hasattr(session, 'sid') else 'session-active',
                            max_age=86400,  # 24 hours
                            secure=True,
                            httponly=True,
                            samesite='None',
                            path='/'
                        )
                        return resp
                    else:
                        logger.error(f"Error refreshing token: {response.status_code} - {response.text}")
                        # If refresh fails, session is invalid
                        session.clear()
                        return jsonify({"authenticated": False, "reason": "Token refresh failed"})
                except Exception as e:
                    logger.error(f"Exception during token refresh: {str(e)}")
                    # If refresh fails, session is invalid
                    session.clear()
                    return jsonify({"authenticated": False, "reason": "Token refresh failed"})
            
            # Update session cookie 
            resp = jsonify({"authenticated": True, "user": session['user']})
            resp.set_cookie(
                app.config['SESSION_COOKIE_NAME'],
                session.sid if hasattr(session, 'sid') else 'session-active',
                max_age=86400,  # 24 hours
                secure=True,
                httponly=True,
                samesite='None',
                path='/'
            )
            return resp
        else:
            logger.warning(f"No valid session found. Session keys: {list(session.keys())}")
            return jsonify({"authenticated": False, "reason": "No session"})
    except Exception as e:
        logger.error(f"Error checking authentication: {str(e)}")
        return jsonify({"authenticated": False, "reason": str(e)})

@app.route('/api/logout')
def logout():
    try:
        logger.info(f"Logging out user. Session keys before logout: {list(session.keys())}")
        # Clear session data
        session.clear()
        session.modified = True
        
        # Add specific cleanup for cookies
        response = jsonify({
            "success": True,
            "message": "Successfully logged out"
        })
        
        # Explicitly expire the session cookie
        response.set_cookie(app.config['SESSION_COOKIE_NAME'], '', expires=0, 
                           secure=True, httponly=True, samesite='None', path='/')
        
        return response
    except Exception as e:
        logger.error(f"Error during logout: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Error during logout: {str(e)}"
        }), 500

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
                    "content": """You are a professional music curator with extensive knowledge of music history, chart hits, and cultural trends across different time periods.

Your task is to suggest 10 specific songs (with artists) that perfectly match the requested mood and genres.

Follow these guidelines:
1. For year or era-specific requests (e.g., '2016 vibes', '90s rock'), prioritize actual popular/charting songs from that time period.
2. Suggest only original songs, NO parodies, karaoke, covers, tributes, or remixes unless specifically requested.
3. Include well-known, high-quality songs that match the requested mood and genres.
4. Prioritize songs that were commercially successful or critically acclaimed.
5. Never include novelty songs, joke songs, or parodies unless explicitly requested.
6. When given a year or decade, focus on songs that were actually popular or influential during that time.
7. Ensure all suggestions are legitimate songs by real artists, not fabricated.
8. Format the response as JSON with fields:
   - songSuggestions (array of {title, artist})
   - description (string explaining why these songs fit the request and how they connect to any specified time period)"""
                },
                {
                    "role": "user",
                    "content": f"Suggest songs for a {mood} playlist with these genres: {', '.join(genres)}"
                }
            ],
            temperature=0.7
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
                # Include original artist in search to avoid covers and karaoke versions
                query = f"artist:{song['artist']} track:{song['title']}"
                results = retry_with_backoff(lambda: sp.search(q=query, type='track', limit=1))
                
                if results['tracks']['items']:
                    track = results['tracks']['items'][0]
                    added_tracks.append(track)
                    logger.info(f"Found track: {track['name']} by {track['artists'][0]['name']}")
                else:
                    # Try a more general search if the specific search failed
                    query = f"{song['artist']} {song['title']}"
                    results = retry_with_backoff(lambda: sp.search(q=query, type='track', limit=1))
                    if results['tracks']['items']:
                        track = results['tracks']['items'][0]
                        added_tracks.append(track)
                        logger.info(f"Found track (general search): {track['name']} by {track['artists'][0]['name']}")
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
        logger.info(f"Generate playlist request received. Session keys: {list(session.keys())}")
        if 'token_info' not in session or 'user' not in session:
            logger.error("User not authenticated - missing session data")
            return jsonify({"error": "User not authenticated"}), 401

        data = request.json
        playlist_description = data.get('description', '')
        
        if not playlist_description:
            logger.error("Missing playlist description")
            return jsonify({"error": "Playlist description is required"}), 400
        
        logger.info(f"Generating playlist with description: {playlist_description[:50]}...")

        # Ensure we have a valid token by forcing a refresh if it's close to expiration
        try:
            now = int(time.time())
            token_info = session['token_info']
            
            # Force refresh if token will expire in the next 10 minutes (600 seconds)
            if token_info['expires_at'] - now < 600:
                logger.info("Token expires soon, refreshing before playlist generation")
                token_url = 'https://accounts.spotify.com/api/token'
                response = requests.post(
                    token_url,
                    data={
                        'grant_type': 'refresh_token',
                        'refresh_token': token_info['refresh_token'],
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
                        'refresh_token': token_info['refresh_token'],
                        'expires_at': int(time.time()) + token_data['expires_in']
                    }
                    session.modified = True
                    logger.info("Successfully refreshed token before playlist generation")
                else:
                    logger.error(f"Failed to refresh token: {response.status_code} - {response.text}")
            
            # Get client with fresh token
            sp = get_spotify_client()
            logger.info("Successfully created Spotify client with fresh token")
        except Exception as e:
            logger.error(f"Failed to ensure valid token: {str(e)}")
            return jsonify({"error": "Authentication error", "details": str(e)}), 401
            
        # Get user's top artists to improve recommendations
        try:
            top_artists = sp.current_user_top_artists(limit=5, time_range='medium_term')
            top_artist_names = []
            top_artist_genres = []
            
            for artist in top_artists['items']:
                top_artist_names.append(artist['name'])
                top_artist_genres.extend(artist['genres'])
            
            # Get unique genres
            top_artist_genres = list(set(top_artist_genres))
            
            logger.info(f"User's top artists: {', '.join(top_artist_names[:3])}...")
            logger.info(f"User's preferred genres: {', '.join(top_artist_genres[:5])}...")
        except Exception as e:
            logger.warning(f"Could not fetch user's top artists: {str(e)}")
            top_artist_names = []
            top_artist_genres = []
        
        # Generate song suggestions using OpenAI
        try:
            openai.api_key = os.getenv('OPENAI_API_KEY')
            
            # Build a more personalized prompt using the user's top artists and genres
            personalization = ""
            if top_artist_names or top_artist_genres:
                personalization = "\n\n## USER PROFILE:"
                if top_artist_names:
                    personalization += f"\n- Favorite Artists: {', '.join(top_artist_names[:5])}"
                if top_artist_genres:
                    personalization += f"\n- Preferred Genres: {', '.join(top_artist_genres[:5])}"
            
            # Extract key aspects from the playlist description
            prompt_analysis = f"""
## PLAYLIST REQUEST:
"{playlist_description}"

{personalization}

## FIRST, ANALYZE THIS REQUEST:
1. Identify specific era/decade mentions (e.g., "90s", "2010s summer")
2. Extract genre keywords (e.g., "rock", "hip-hop", "indie folk")
3. Identify mood/vibe descriptors (e.g., "chill", "upbeat", "melancholic")
4. Note any activity contexts (e.g., "workout", "studying", "road trip")
5. Identify any specific artist influences mentioned

## THEN, GENERATE SONG SELECTIONS:
Based on your analysis, provide 15-20 highly relevant songs that precisely match the request.
"""
            
            completion = openai.ChatCompletion.create(
                model="gpt-4o",  # Using GPT-4o for superior music knowledge and taste
                messages=[
                    {
                        "role": "system",
                        "content": """You are an elite music curator with encyclopedic knowledge of music across all eras, genres, and cultures. Your recommendations are always authentic, accurate, and perfectly tailored to the request.

## YOUR CAPABILITIES:
- Deep understanding of music history, styles, scenes, and cultural significance
- Extensive knowledge of chart hits and underground classics from all decades
- Ability to match songs precisely to moods, activities, and specific requests
- Recognition of subtle distinctions between subgenres and music movements

## STRICT RULES:
1. NEVER suggest karaoke, covers, remixes, or tributes - ONLY original studio recordings
2. For year-specific requests (e.g., "2016 hits"), ONLY include songs that were actually released or popular in that EXACT timeframe
3. For decade requests (e.g., "90s rock"), choose defining songs that genuinely represent that era's sound
4. Never include more than one song by the same artist
5. ONLY include real, streamable songs (no made-up tracks)
6. Ensure genre accuracy - don't include pop songs when rock is requested
7. Format each song as: "Song Title by Artist Name"
8. NEVER provide commentary or explanations with the songs

## ANALYSIS APPROACH:
1. First, thoroughly analyze the request to understand the exact era, genre, mood, and context
2. Consider the user's known preferences but balance with discovery
3. For ambiguous requests, lean toward mainstream hits for better recognition
4. For specific genre requests, include authentic examples that define that sound
5. For mood-based requests, focus on songs that genuinely evoke that emotional state

## OUTPUT FORMAT:
Only list song recommendations - do not include introductions, explanations, or commentary.
"""
                    },
                    {
                        "role": "user",
                        "content": prompt_analysis
                    }
                ],
                temperature=0.75,
                max_tokens=1500,
                top_p=0.9,
                presence_penalty=0.4,
                frequency_penalty=0.6
            )
            
            # Process the GPT response to extract songs
            song_text = completion.choices[0].message['content'].strip()
            
            # Try to extract songs with different patterns
            song_list = []
            
            # Look for numbered lists (1. Song by Artist)
            numbered_pattern = re.compile(r'^\d+\.\s*(.+?)\s+by\s+(.+?)$', re.MULTILINE)
            for match in numbered_pattern.finditer(song_text):
                song_list.append(f"{match.group(1)} by {match.group(2)}")
            
            # Look for bullet points (• Song by Artist)
            bullet_pattern = re.compile(r'^[•\-\*]\s*(.+?)\s+by\s+(.+?)$', re.MULTILINE)
            for match in bullet_pattern.finditer(song_text):
                song_list.append(f"{match.group(1)} by {match.group(2)}")
            
            # Look for plain "Song by Artist" format
            plain_pattern = re.compile(r'^(.+?)\s+by\s+(.+?)$', re.MULTILINE)
            # Only use this if we don't have enough songs yet
            if len(song_list) < 10:
                for match in plain_pattern.finditer(song_text):
                    song_list.append(f"{match.group(1)} by {match.group(2)}")
            
            # Fallback: if we still don't have songs, split by newlines and look for "by"
            if len(song_list) < 5:
                for line in song_text.split('\n'):
                    if " by " in line and not line.startswith('#') and not line.startswith('*'):
                        song_list.append(line.strip())
            
            # Remove duplicates while preserving order
            seen = set()
            song_list = [x for x in song_list if not (x.lower() in seen or seen.add(x.lower()))]
            
            # Log the extracted song list
            logger.info(f"Generated song list with {len(song_list)} tracks")
            if len(song_list) < 5:
                logger.warning(f"Low number of songs extracted. Raw GPT response: {song_text[:500]}")
            
            # Search for tracks on Spotify with more advanced filtering
            track_uris = []
            tracks = []
            added_artists = set()  # Track artists we've already added to avoid duplicates
            
            for song in song_list:
                # Try to extract artist and track
                parts = song.split(" by ")
                if len(parts) == 2:
                    track_name = parts[0].strip()
                    artist_name = parts[1].strip()
                    
                    # Check if we already have a song by this artist
                    if artist_name.lower() in added_artists:
                        logger.info(f"Skipping duplicate artist: {artist_name}")
                        continue
                    
                    # Clean up track and artist names for better search results
                    # Remove text in parentheses or brackets which might confuse search
                    clean_track_name = re.sub(r'\([^)]*\)|\[[^\]]*\]', '', track_name).strip()
                    clean_artist_name = re.sub(r'\([^)]*\)|\[[^\]]*\]', '', artist_name).strip()
                    
                    # Search with artist and track parameters - exclude karaoke versions explicitly
                    search_url = "https://api.spotify.com/v1/search"
                    headers = {"Authorization": f"Bearer {session['token_info']['access_token']}"}
                    
                    # Try three search strategies in order of specificity
                    search_strategies = [
                        # 1. Exact artist and track with negative filters
                        {
                            "query": f"artist:\"{clean_artist_name}\" track:\"{clean_track_name}\" NOT karaoke NOT tribute NOT cover NOT remake NOT instrumental NOT live NOT remix",
                            "description": "exact search with filters"
                        },
                        # 2. Exact artist and track without negative filters
                        {
                            "query": f"artist:\"{clean_artist_name}\" track:\"{clean_track_name}\"",
                            "description": "exact search"
                        },
                        # 3. General search with artist name and track
                        {
                            "query": f"\"{clean_track_name}\" \"{clean_artist_name}\" NOT karaoke NOT cover NOT tribute",
                            "description": "general search"
                        }
                    ]
                    
                    found_track = False
                    for strategy in search_strategies:
                        if found_track:
                            break
                            
                        try:
                            params = {"q": strategy["query"], "type": "track", "limit": 5, "market": "US"}
                            
                            # Add retry logic with backoff for search requests
                            def search_request():
                                search_response = requests.get(
                                    search_url, 
                                    headers=headers, 
                                    params=params, 
                                    timeout=10  # Add timeout to prevent hanging
                                )
                                if search_response.status_code != 200:
                                    logger.error(f"Search API error: {search_response.status_code} - {search_response.text}")
                                    search_response.raise_for_status()
                                return search_response.json()
                            
                            # Use retry with backoff for search
                            try:
                                search_results = retry_with_backoff(
                                    search_request, 
                                    max_retries=2,  # Fewer retries for search to avoid slowdowns
                                    initial_delay=0.5
                                )
                            except Exception as search_err:
                                logger.warning(f"Search failed after retries: {str(search_err)}")
                                continue  # Try next search strategy
                            
                            items = search_results.get('tracks', {}).get('items', [])
                            
                            if not items:
                                logger.info(f"No results for '{clean_track_name}' by '{clean_artist_name}' using {strategy['description']}")
                                continue
                            
                            # Filter out suspicious tracks
                            filtered_items = [
                                item for item in items 
                                if not any(keyword in item['name'].lower() for keyword in 
                                          ['karaoke', 'tribute', 'cover', 'made famous', 'instrumental', 'remake'])
                            ]
                            
                            if filtered_items:
                                # Sort by popularity
                                filtered_items.sort(key=lambda x: x.get('popularity', 0), reverse=True)
                                track = filtered_items[0]
                                
                                # Check for duplicate artists
                                track_artist = track['artists'][0]['name'].lower()
                                if track_artist in added_artists:
                                    logger.info(f"Skipping duplicate artist (fallback search): {track_artist}")
                                    continue
                                    
                                added_artists.add(track_artist)
                                track_uris.append(track['uri'])
                                tracks.append({
                                    'name': track['name'],
                                    'artist': track['artists'][0]['name'],
                                    'album_image': track['album']['images'][0]['url'] if track['album']['images'] else None
                                })
                                found_track = True
                                logger.info(f"Found track: '{track['name']}' by '{track['artists'][0]['name']}' using {strategy['description']}")
                                break
                            
                        except Exception as e:
                            logger.warning(f"Error searching for '{clean_track_name}' by '{clean_artist_name}': {str(e)}")
                            continue
                else:
                    # Handle malformatted songs without "by"
                    logger.warning(f"Malformatted song suggestion: {song}")
                    # Try a general search if the specific search failed
                    try:
                        search_url = "https://api.spotify.com/v1/search"
                        headers = {"Authorization": f"Bearer {session['token_info']['access_token']}"}
                        
                        general_query = f"{song} NOT karaoke NOT tribute NOT cover"
                        params = {"q": general_query, "type": "track", "limit": 3, "market": "US"}
                        
                        res = requests.get(search_url, headers=headers, params=params)
                        if res.status_code == 200:
                            search_results = res.json()
                            items = search_results.get('tracks', {}).get('items', [])
                            
                            # Filter out suspicious tracks
                            filtered_items = [
                                item for item in items 
                                if not any(keyword in item['name'].lower() for keyword in 
                                          ['karaoke', 'tribute', 'cover', 'made famous', 'instrumental', 'remake'])
                            ]
                            
                            if filtered_items:
                                # Sort by popularity
                                filtered_items.sort(key=lambda x: x.get('popularity', 0), reverse=True)
                                track = filtered_items[0]
                                
                                # Check for duplicate artists
                                track_artist = track['artists'][0]['name'].lower()
                                if track_artist in added_artists:
                                    logger.info(f"Skipping duplicate artist (fallback search): {track_artist}")
                                    continue
                                    
                                added_artists.add(track_artist)
                                track_uris.append(track['uri'])
                                tracks.append({
                                    'name': track['name'],
                                    'artist': track['artists'][0]['name'],
                                    'album_image': track['album']['images'][0]['url'] if track['album']['images'] else None
                                })
                    except Exception as e:
                        logger.warning(f"Failed general search for '{song}': {str(e)}")

            # Log summary of tracks found
            if tracks:
                logger.info(f"Successfully found {len(tracks)} tracks from song suggestions")
                logger.info(f"First few tracks: {', '.join([f'{t['name']} by {t['artist']}' for t in tracks[:3]])}")
            else:
                logger.warning("No tracks found from song suggestions")

            # Function to check string similarity (for artist name matching)
            def self_similar(str1, str2, threshold=0.8):
                """Check if two strings are similar using character-level comparison."""
                if not str1 or not str2:
                    return False
                    
                # Quick check for exact match or substring
                if str1 == str2 or str1 in str2 or str2 in str1:
                    return True
                
                # Simple character-based similarity
                str1_chars = set(str1)
                str2_chars = set(str2)
                intersection = str1_chars.intersection(str2_chars)
                union = str1_chars.union(str2_chars)
                
                jaccard = len(intersection) / len(union) if union else 0
                return jaccard >= threshold

            # Create playlist only if we have enough tracks or can get recommendations
            if len(tracks) == 0:
                logger.error("No tracks found for playlist")
                return jsonify({"error": "No tracks found matching your request. Please try with a different description."}), 400
            
            # If we found fewer than minimum tracks (5), add fallback popular tracks based on described genres
            if len(tracks) < 5:
                logger.warning(f"Only found {len(tracks)} tracks, adding fallback popular tracks")
                
                # Try to extract genres from the description
                possible_genres = [
                    'pop', 'rock', 'hip-hop', 'rap', 'r&b', 'country', 'folk', 'jazz',
                    'blues', 'electronic', 'dance', 'indie', 'classical', 'metal'
                ]
                
                detected_genres = []
                description_lower = playlist_description.lower()
                
                for genre in possible_genres:
                    if genre in description_lower:
                        detected_genres.append(genre)
                
                # If no genres detected, use general popular tracks
                if not detected_genres:
                    detected_genres = ['pop']
                
                # Get popular tracks for each detected genre
                for genre in detected_genres[:3]:  # Limit to 3 genres
                    try:
                        search_query = f"genre:{genre}"
                        popular_tracks_response = sp.search(q=search_query, type='track', limit=10, market='US')
                        
                        for item in popular_tracks_response['tracks']['items']:
                            # Skip if we already have a track by this artist
                            track_artist = item['artists'][0]['name'].lower()
                            if track_artist in added_artists:
                                continue
                                
                            added_artists.add(track_artist)
                            track_uris.append(item['uri'])
                            tracks.append({
                                'name': item['name'],
                                'artist': item['artists'][0]['name'],
                                'album_image': item['album']['images'][0]['url'] if item['album']['images'] else None
                            })
                            
                            # Stop if we have enough tracks
                            if len(tracks) >= 15:
                                break
                    except Exception as e:
                        logger.warning(f"Error getting popular {genre} tracks: {str(e)}")
                
                logger.info(f"Added fallback popular tracks, now have {len(tracks)} tracks total")
            
            # Try to reach at least 15 tracks by adding related tracks if needed
            if len(tracks) < 15:
                logger.info(f"Only found {len(tracks)} tracks, adding related tracks to reach 15-20 total")
                try:
                    # Extract audio features for the tracks we've found to better understand the playlist's vibe
                    audio_features = None
                    avg_features = {
                        'danceability': 0.5,
                        'energy': 0.5,
                        'tempo': 120,
                        'valence': 0.5
                    }
                    
                    if track_uris:
                        try:
                            # Get audio features for found tracks to understand the playlist's sound profile
                            audio_features_url = "https://api.spotify.com/v1/audio-features"
                            params = {"ids": ",".join([uri.split(":")[-1] for uri in track_uris[:10]])}
                            audio_res = requests.get(
                                audio_features_url, 
                                headers={"Authorization": f"Bearer {session['token_info']['access_token']}"},
                                params=params
                            )
                            
                            if audio_res.status_code == 200:
                                audio_features = audio_res.json().get('audio_features', [])
                                if audio_features:
                                    # Calculate averages for key parameters
                                    feature_sums = {
                                        'danceability': 0,
                                        'energy': 0,
                                        'tempo': 0,
                                        'valence': 0  # happiness/positivity
                                    }
                                    count = 0
                                    
                                    for feature in audio_features:
                                        if feature:  # Some tracks might not have features
                                            count += 1
                                            for key in feature_sums.keys():
                                                if key in feature:
                                                    feature_sums[key] += feature[key]
                                    
                                    if count > 0:
                                        for key in feature_sums:
                                            avg_features[key] = feature_sums[key] / count
                                    
                                    logger.info(f"Average audio features: {avg_features}")
                        except Exception as e:
                            logger.warning(f"Error getting audio features: {str(e)}")
                    
                    # Determine playlist mood from description or audio features
                    playlist_mood = "unknown"
                    is_happy = avg_features['valence'] > 0.6
                    is_energetic = avg_features['energy'] > 0.6
                    is_dance = avg_features['danceability'] > 0.6
                    
                    # Check description for mood indicators
                    if any(term in playlist_description.lower() for term in ['happy', 'upbeat', 'cheerful', 'joyful']):
                        playlist_mood = "happy"
                    elif any(term in playlist_description.lower() for term in ['sad', 'melancholic', 'emotional', 'heartbreak']):
                        playlist_mood = "sad"
                    elif any(term in playlist_description.lower() for term in ['energetic', 'workout', 'pump', 'energy']):
                        playlist_mood = "energetic"
                    elif any(term in playlist_description.lower() for term in ['chill', 'relax', 'calm', 'study']):
                        playlist_mood = "chill"
                    elif is_happy:
                        playlist_mood = "happy"
                    elif is_energetic:
                        playlist_mood = "energetic"
                    elif is_dance:
                        playlist_mood = "dance"
                    
                    # Use a mix of recommendations based on our best tracks, genres, and audio features
                    seed_tracks = []
                    seed_artists = []
                    seed_genres = []
                    
                    # Pick best seed tracks based on popularity if we have any tracks
                    if track_uris:
                        # Get full track objects to check popularity
                        tracks_url = "https://api.spotify.com/v1/tracks"
                        params = {"ids": ",".join([uri.split(":")[-1] for uri in track_uris[:10]])}
                        tracks_res = requests.get(
                            tracks_url, 
                            headers={"Authorization": f"Bearer {session['token_info']['access_token']}"},
                            params=params
                        )
                        
                        if tracks_res.status_code == 200:
                            full_tracks = tracks_res.json().get('tracks', [])
                            # Sort by popularity and take the top 2
                            full_tracks.sort(key=lambda x: x.get('popularity', 0), reverse=True)
                            seed_tracks = [track['id'] for track in full_tracks[:2] if track and 'id' in track]
                    
                    # Extract genres from the description
                    description_lower = playlist_description.lower()
                    possible_genres = [
                        'rock', 'pop', 'hip-hop', 'rap', 'r&b', 'country', 'folk', 'jazz',
                        'blues', 'electronic', 'dance', 'indie', 'classical', 'metal',
                        'alternative', 'punk', 'soul', 'reggae', 'funk', 'disco',
                        'techno', 'house', 'ambient', 'edm', 'lo-fi', 'latin'
                    ]
                    
                    detected_genres = []
                    for genre in possible_genres:
                        if genre in description_lower or f"{genre} music" in description_lower:
                            detected_genres.append(genre)
                    
                    # Add genres from description first
                    for genre in detected_genres[:2]:  # Max 2 genres from description
                        if len(seed_genres) + len(seed_tracks) + len(seed_artists) < 5:
                            seed_genres.append(genre)
                    
                    # If we still have room, add genres from user's top genres
                    if top_artist_genres and len(seed_genres) + len(seed_tracks) + len(seed_artists) < 5:
                        valid_genres = set(possible_genres + ['r-n-b'])  # Spotify uses r-n-b instead of r&b
                        for genre in top_artist_genres:
                            if genre in valid_genres and len(seed_genres) + len(seed_tracks) + len(seed_artists) < 5:
                                if genre not in seed_genres:  # Avoid duplicates
                                    seed_genres.append(genre)
                    
                    # If we still need more seeds, add top artists
                    if top_artists.get('items') and len(seed_genres) + len(seed_tracks) + len(seed_artists) < 5:
                        for artist in top_artists['items']:
                            if len(seed_artists) + len(seed_tracks) + len(seed_genres) < 5:
                                # Check if this artist's genre matches our playlist
                                if not detected_genres or any(genre in artist.get('genres', []) for genre in detected_genres):
                                    seed_artists.append(artist['id'])
                    
                    # Check if we have enough seeds
                    if seed_tracks or seed_artists or seed_genres:
                        # Set up recommendation parameters based on playlist mood and audio features
                        recommendation_params = {
                            'limit': min(30, 20 - len(tracks)),  # Request more than needed to allow filtering
                            'market': 'US'
                        }
                        
                        # Add seed parameters
                        if seed_tracks:
                            recommendation_params['seed_tracks'] = ','.join(seed_tracks[:2])
                        if seed_artists:
                            recommendation_params['seed_artists'] = ','.join(seed_artists[:2])
                        if seed_genres:
                            recommendation_params['seed_genres'] = ','.join(seed_genres[:2])
                        
                        # Set target audio features based on the playlist type
                        if playlist_mood == "happy":
                            recommendation_params['target_valence'] = min(0.9, avg_features['valence'] + 0.1)
                            recommendation_params['target_energy'] = min(0.9, avg_features['energy'] + 0.1)
                        elif playlist_mood == "sad":
                            recommendation_params['target_valence'] = max(0.1, avg_features['valence'] - 0.1)
                            recommendation_params['target_energy'] = max(0.1, avg_features['energy'] - 0.1)
                        elif playlist_mood == "energetic":
                            recommendation_params['target_energy'] = min(0.95, avg_features['energy'] + 0.2)
                            recommendation_params['min_tempo'] = avg_features['tempo'] * 0.9
                        elif playlist_mood == "chill":
                            recommendation_params['target_energy'] = max(0.1, avg_features['energy'] - 0.2)
                            recommendation_params['target_acousticness'] = 0.7
                        elif playlist_mood == "dance":
                            recommendation_params['target_danceability'] = min(0.95, avg_features['danceability'] + 0.2)
                        else:
                            # Use the average features with slight adjustments for consistency
                            recommendation_params['target_danceability'] = avg_features['danceability']
                            recommendation_params['target_energy'] = avg_features['energy']
                            recommendation_params['target_valence'] = avg_features['valence']
                        
                        logger.info(f"Recommendation parameters: {recommendation_params}")
                        recommendations = sp._get('recommendations', params=recommendation_params)
                        
                        if recommendations and recommendations.get('tracks'):
                            # Add only tracks from artists we haven't included yet
                            recommended_tracks = recommendations['tracks']
                            
                            # Sort by popularity for better quality recommendations
                            recommended_tracks.sort(key=lambda x: x.get('popularity', 0), reverse=True)
                            
                            added_count = 0
                            for rec_track in recommended_tracks:
                                rec_artist = rec_track['artists'][0]['name'].lower()
                                if rec_artist not in added_artists and len(tracks) < 20:
                                    # Verify the track isn't a cover, remix, etc.
                                    if not any(keyword in rec_track['name'].lower() for keyword in 
                                            ['karaoke', 'tribute', 'cover', 'made famous', 'instrumental', 'remake']):
                                        added_artists.add(rec_artist)
                                        track_uris.append(rec_track['uri'])
                                        tracks.append({
                                            'name': rec_track['name'],
                                            'artist': rec_track['artists'][0]['name'],
                                            'album_image': rec_track['album']['images'][0]['url'] if rec_track['album']['images'] else None
                                        })
                                        added_count += 1
                            
                            logger.info(f"Added {added_count} recommendation tracks, total: {len(tracks)}")
                except Exception as e:
                    logger.warning(f"Error adding recommendation tracks: {str(e)}")
                    logger.exception(e)

            # Create playlist
            create_playlist_url = f"https://api.spotify.com/v1/users/{session['user']['id']}/playlists"
            playlist_title = f"AI Generated: {playlist_description[:30]}..." if len(playlist_description) > 30 else f"AI Generated: {playlist_description}"
            payload = {
                "name": playlist_title,
                "description": f"Generated by Moosic AI based on: {playlist_description}",
                "public": False
            }
            
            try:
                # Use retry_with_backoff for playlist creation
                def create_playlist_request():
                    response = requests.post(
                        create_playlist_url,
                        headers={"Authorization": f"Bearer {session['token_info']['access_token']}"},
                        json=payload
                    )
                    if response.status_code != 201:
                        logger.error(f"Failed to create playlist: {response.status_code} - {response.text}")
                        response.raise_for_status()
                    return response.json()
                
                playlist_data = retry_with_backoff(create_playlist_request, max_retries=3, initial_delay=1)
                playlist_id = playlist_data['id']
                logger.info(f"Successfully created playlist with ID: {playlist_id}")
                
                # Add tracks to playlist in chunks to avoid request size limitations
                if track_uris:
                    # Split into chunks of 100 tracks (Spotify API limit)
                    def chunks(lst, n):
                        for i in range(0, len(lst), n):
                            yield lst[i:i + n]
                    
                    track_uri_chunks = list(chunks(track_uris, 100))
                    
                    for i, chunk in enumerate(track_uri_chunks):
                        def add_tracks_request():
                            add_tracks_url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
                            add_payload = {"uris": chunk}
                            
                            add_res = requests.post(
                                add_tracks_url,
                                headers={"Authorization": f"Bearer {session['token_info']['access_token']}"},
                                json=add_payload
                            )
                            
                            if add_res.status_code not in [201, 200]:
                                logger.error(f"Failed to add tracks (chunk {i+1}/{len(track_uri_chunks)}): {add_res.status_code} - {add_res.text}")
                                add_res.raise_for_status()
                            return add_res.json()
                        
                        # Retry adding tracks with exponential backoff
                        retry_with_backoff(add_tracks_request, max_retries=3, initial_delay=1)
                        logger.info(f"Added track chunk {i+1}/{len(track_uri_chunks)} ({len(chunk)} tracks) to playlist {playlist_id}")
                else:
                    logger.warning("No tracks to add to playlist")
                
                return jsonify({
                    "success": True,
                    "playlist_url": playlist_data['external_urls']['spotify'],
                    "playlist_name": playlist_data['name'],
                    "tracks": tracks
                })
                
            except requests.exceptions.HTTPError as http_err:
                logger.error(f"HTTP error occurred: {http_err}")
                # Check if token expired
                if http_err.response.status_code == 401:
                    return jsonify({"error": "Authentication expired. Please log in again."}), 401
                return jsonify({"error": f"Failed to create or update playlist: {str(http_err)}"}), http_err.response.status_code
            except Exception as e:
                logger.error(f"Error creating playlist: {str(e)}")
                logger.exception(e)
                return jsonify({"error": f"Failed to create playlist: {str(e)}"}), 500

        except Exception as e:
            logger.error(f"Error in playlist generation: {str(e)}")
            return jsonify({"error": str(e)}), 500

    except Exception as e:
        logger.error(f"Error in generate-playlist route: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/user/top-tracks')
def get_top_tracks():
    try:
        logger.info("Getting user's top tracks")
        sp = get_spotify_client()
        
        # Get user's top tracks (short_term = ~4 weeks, medium_term = ~6 months, long_term = several years)
        try:
            top_tracks_response = sp.current_user_top_tracks(limit=20, time_range='medium_term')
        except spotipy.SpotifyException as spotify_err:
            logger.error(f"Spotify API error: {spotify_err}")
            if "Insufficient client scope" in str(spotify_err):
                return jsonify({
                    'error': 'Insufficient client scope. Please reauthorize the application with the required permissions.',
                    'code': 'insufficient_scope'
                }), 403
            return jsonify({'error': str(spotify_err)}), 401
        
        tracks = []
        for item in top_tracks_response['items']:
            track = {
                'id': item['id'],
                'name': item['name'],
                'artist': item['artists'][0]['name'] if item['artists'] else 'Unknown Artist',
                'album_image': item['album']['images'][0]['url'] if item['album']['images'] else None,
                'preview_url': item['preview_url']
            }
            tracks.append(track)
        
        return jsonify({
            'tracks': tracks
        })
    except Exception as e:
        logger.error(f"Error getting top tracks: {str(e)}")
        return jsonify({'error': str(e)}), 401

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