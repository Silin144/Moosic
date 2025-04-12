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
from fuzzywuzzy import fuzz

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
     origins="*", 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "Accept"],
     methods=["GET", "POST", "OPTIONS"],
     expose_headers=["Content-Type", "Authorization", "Set-Cookie"]
)

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin', '')
    # Apply CORS headers to all origins during debugging
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

# Configure OpenAI API key
openai.api_key = os.getenv('OPENAI_API_KEY')

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
        logger.info(f"Request cookies: {request.cookies}")
        logger.info(f"Request origin: {request.headers.get('Origin', 'No origin')}")
        logger.info(f"Request headers: {dict(request.headers)}")
        
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
        suggestions_content = completion.choices[0].message['content']
        
        suggestions = json.loads(suggestions_content)
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
            top_artist_ids = []
            
            for artist in top_artists['items']:
                top_artist_names.append(artist['name'])
                top_artist_genres.extend(artist['genres'])
                top_artist_ids.append(artist['id'])
            
            # Get unique genres
            top_artist_genres = list(set(top_artist_genres))
            
            logger.info(f"User's top artists: {', '.join(top_artist_names[:3])}...")
            logger.info(f"User's preferred genres: {', '.join(top_artist_genres[:5])}...")
            
            # Get user's top tracks for better seed data
            top_tracks = sp.current_user_top_tracks(limit=5, time_range='medium_term')
            top_track_ids = []
            
            for track in top_tracks['items']:
                top_track_ids.append(track['id'])
            
        except Exception as e:
            logger.warning(f"Could not fetch user's top artists or tracks: {str(e)}")
            top_artist_names = []
            top_artist_genres = []
            top_artist_ids = []
            top_track_ids = []
        
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
Based on your analysis, provide EXACTLY 25 highly relevant songs that precisely match the request. Focus on quality, variety, and accuracy.
Prioritize well-known, mainstream songs that are likely available on Spotify.
"""
            
            # Create the user prompt
            user_prompt = f"""
            I need you to create a playlist with at least 75 songs based on this request: "{prompt}".
            {personalization}
            Do not include any explanations - only respond with a list of real songs in the format "Song Name by Artist Name", one per line.
            """
            
            logger.info(f"Sending prompt to OpenAI: {user_prompt[:100]}...")
            
            # Call OpenAI API - handle both old and new API versions
            response = openai.ChatCompletion.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": prompt_analysis},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            # Parse the response
            content = response.choices[0].message.content.strip()
            
            logger.info(f"Received response from OpenAI: {len(content)} characters")
            
            # Split the response into individual songs
            songs = [song.strip() for song in content.split('\n') if song.strip()]
            logger.info(f"Extracted {len(songs)} songs from OpenAI response")
            
        except Exception as e:
            logger.error(f"Error in OpenAI API call: {str(e)}")
            logger.exception(e)
            songs = []
            
        # Search for each song on Spotify and collect track URIs
        track_uris = []
        tracks = []
        added_artists = set()  # Track artists we've already added to avoid duplicates
        
        # Helper for finding tracks
        def search_and_add_tracks(search_query, limit=3):
            search_url = "https://api.spotify.com/v1/search"
            headers = {"Authorization": f"Bearer {session['token_info']['access_token']}"}
            params = {"q": search_query, "type": "track", "limit": limit, "market": "US"}
            
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
                    
                    for item in filtered_items:
                        # Check for duplicate artists
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
                        return True
            return False
        
        # Process songs from OpenAI suggestions
        if songs:
            for song in songs:
                # Skip if we already have enough tracks
                if len(tracks) >= 25:
                    break
                    
                if "by" in song:
                    track_name, artist_name = song.split("by", 1)
                    track_name = track_name.strip()
                    artist_name = artist_name.strip()
                    
                    # Clean the strings to improve search accuracy
                    clean_track_name = re.sub(r'[^\w\s]', '', track_name).strip()
                    clean_artist_name = re.sub(r'[^\w\s]', '', artist_name).strip()
                    
                    # Try multiple search strategies
                    specific_query = f"artist:{clean_artist_name} track:{clean_track_name}"
                    found = search_and_add_tracks(specific_query)
                    
                    if not found:
                        general_query = f"{clean_track_name} {clean_artist_name}"
                        found = search_and_add_tracks(general_query)
                        
                        if not found:
                            quoted_query = f"\"{clean_track_name}\" \"{clean_artist_name}\" NOT karaoke NOT cover NOT tribute"
                            search_and_add_tracks(quoted_query)
                else:
                    # Handle malformatted songs without "by"
                    search_and_add_tracks(song.strip())
                        
        # Log what we found so far
        if tracks:
            logger.info(f"Successfully found {len(tracks)} tracks from OpenAI suggestions")
            logger.info("First few tracks: " + ", ".join([f"{t['name']} by {t['artist']}" for t in tracks[:3]]))
        else:
            logger.warning("No tracks found from OpenAI suggestions")
            
        # Extract mood, genres and era from playlist description for better recommendations
        description_lower = playlist_description.lower()
        
        # Detect mood from description
        mood_mapping = {
            'happy': {'valence': 0.8, 'energy': 0.7},
            'sad': {'valence': 0.2, 'energy': 0.4},
            'energetic': {'energy': 0.9, 'tempo': 140},
            'chill': {'energy': 0.3, 'acousticness': 0.7, 'tempo': 90},
            'relaxed': {'energy': 0.3, 'acousticness': 0.6, 'valence': 0.5},
            'angry': {'energy': 0.8, 'valence': 0.3, 'tempo': 130},
            'romantic': {'valence': 0.6, 'energy': 0.4, 'acousticness': 0.5},
            'workout': {'energy': 0.9, 'tempo': 150},
            'party': {'danceability': 0.8, 'energy': 0.8, 'tempo': 120},
            'focus': {'energy': 0.4, 'instrumentalness': 0.5, 'acousticness': 0.5},
            'sleep': {'energy': 0.1, 'acousticness': 0.8, 'instrumentalness': 0.6}
        }
        
        # Build mood profile based on keywords in description
        mood_profile = {'valence': 0.5, 'energy': 0.5, 'tempo': 120, 'danceability': 0.5}
        
        for mood, attributes in mood_mapping.items():
            if mood in description_lower or f"{mood} music" in description_lower:
                for attr, value in attributes.items():
                    mood_profile[attr] = value
                    
        # Extract genres and era
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
                
        # Extract era/decade
        era_patterns = {
            '50s': {'min_year': 1950, 'max_year': 1959, 'keywords': ['50s', 'fifties', '1950s']},
            '60s': {'min_year': 1960, 'max_year': 1969, 'keywords': ['60s', 'sixties', '1960s']},
            '70s': {'min_year': 1970, 'max_year': 1979, 'keywords': ['70s', 'seventies', '1970s']},
            '80s': {'min_year': 1980, 'max_year': 1989, 'keywords': ['80s', 'eighties', '1980s']},
            '90s': {'min_year': 1990, 'max_year': 1999, 'keywords': ['90s', 'nineties', '1990s']},
            '2000s': {'min_year': 2000, 'max_year': 2009, 'keywords': ['00s', '2000s', 'two thousands']},
            '2010s': {'min_year': 2010, 'max_year': 2019, 'keywords': ['10s', '2010s', 'twenty tens']},
            '2020s': {'min_year': 2020, 'max_year': 2029, 'keywords': ['20s', '2020s', 'twenty twenties']}
        }
        
        detected_era = None
        min_year = None
        max_year = None
        
        for era, info in era_patterns.items():
            for keyword in info['keywords']:
                if keyword in description_lower:
                    detected_era = era
                    min_year = info['min_year']
                    max_year = info['max_year']
                    break
            if detected_era:
                break
                
        # Now use all this information to get additional tracks from Spotify recommendations
        remaining_slots = 50 - len(tracks)
        
        if remaining_slots > 0 and (len(tracks) > 0 or top_track_ids or top_artist_ids or detected_genres):
            logger.info(f"Need {remaining_slots} more tracks to reach 50 total")
            
            # Prepare seed data for recommendations
            seed_tracks = track_uris[:2] if track_uris else top_track_ids[:2]
            seed_artists = top_artist_ids[:2] if top_artist_ids else []
            seed_genres = detected_genres[:1] if detected_genres else top_artist_genres[:1] if top_artist_genres else []
            
            # Make sure we have at least one seed
            if not seed_tracks and not seed_artists and not seed_genres:
                # If we really have nothing, use a popular genre
                seed_genres = ['pop']
                
            # Build recommendations parameters based on our analysis
            rec_params = {
                'limit': min(100, remaining_slots * 2),  # Request more than needed to allow filtering
                'market': 'US'
            }
            
            # Add seed parameters - we can use up to 5 seeds total
            remaining_seeds = 5
            
            # Add seed tracks (up to 2)
            if seed_tracks:
                use_tracks = seed_tracks[:min(2, remaining_seeds)]
                rec_params['seed_tracks'] = ','.join(use_tracks)
                remaining_seeds -= len(use_tracks)
                
            # Add seed artists (up to 2)
            if seed_artists and remaining_seeds > 0:
                use_artists = seed_artists[:min(2, remaining_seeds)]
                rec_params['seed_artists'] = ','.join(use_artists)
                remaining_seeds -= len(use_artists)
                
            # Add seed genres (at least 1, up to remaining slots)
            if seed_genres and remaining_seeds > 0:
                use_genres = seed_genres[:min(remaining_seeds, len(seed_genres))]
                rec_params['seed_genres'] = ','.join(use_genres)
                
            # Add mood parameters
            for param, value in mood_profile.items():
                rec_params[f'target_{param}'] = value
                
            # Add era parameters if detected
            if min_year and max_year:
                # Unfortunately Spotify doesn't have a direct year filter, so we have to filter results afterward
                pass
                
            # Add popularity filter for better-known tracks
            rec_params['min_popularity'] = 40
                
            # Get recommendations
            logger.info(f"Recommendation parameters: {rec_params}")
            
            try:
                recommendations = sp._get('recommendations', params=rec_params)
                
                if recommendations and recommendations.get('tracks'):
                    # Sort results by popularity for better quality tracks
                    recommended_tracks = recommendations['tracks']
                    recommended_tracks.sort(key=lambda x: x.get('popularity', 0), reverse=True)
                    
                    # Filter for era if needed
                    if min_year and max_year:
                        try:
                            # Get detailed album info for each track to check release year
                            era_filtered_tracks = []
                            for track in recommended_tracks:
                                # Skip this checking if we already have enough tracks
                                if len(tracks) + len(era_filtered_tracks) >= 50:
                                    break
                                    
                                album_id = track['album']['id']
                                album_details = sp.album(album_id)
                                
                                # Parse release year from release_date
                                release_date = album_details['release_date']
                                release_year = int(release_date.split('-')[0])
                                
                                if min_year <= release_year <= max_year:
                                    era_filtered_tracks.append(track)
                                    
                            # Replace our recommendations with the filtered list
                            if era_filtered_tracks:
                                recommended_tracks = era_filtered_tracks
                        except Exception as e:
                            logger.warning(f"Error filtering by era: {str(e)}")
                    
                    # Add tracks from recommendations
                    for rec_track in recommended_tracks:
                        # Only add more tracks if we haven't reached 50
                        if len(tracks) >= 50:
                            break
                            
                        rec_artist = rec_track['artists'][0]['name'].lower()
                        # Skip if we already have this artist
                        if rec_artist in added_artists:
                            continue
                            
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
                    
                    logger.info(f"Added {len(tracks) - (50 - remaining_slots)} tracks from recommendations")
                else:
                    logger.warning("No recommendation tracks returned from Spotify API")
            except Exception as e:
                logger.error(f"Error getting Spotify recommendations: {str(e)}")
                logger.exception(e)
        
        # If we STILL don't have enough tracks, search for generic popular tracks in the detected genres or user's top genres
        remaining_slots = 50 - len(tracks)
        if remaining_slots > 0:
            logger.warning(f"Still need {remaining_slots} more tracks - searching for popular genre tracks")
            
            # Determine which genres to use
            search_genres = detected_genres if detected_genres else top_artist_genres[:3] if top_artist_genres else ['pop']
            
            for genre in search_genres:
                # Only continue if we need more tracks
                if len(tracks) >= 50:
                    break
                    
                # Search for popular tracks in this genre
                try:
                    genre_query = f"genre:{genre}"
                    search_params = {
                        "q": genre_query,
                        "type": "track",
                        "limit": min(50, 50 - len(tracks)),
                        "market": "US"
                    }
                    
                    search_results = sp.search(**search_params)
                    
                    if search_results and search_results['tracks']['items']:
                        # Filter and add tracks
                        for item in search_results['tracks']['items']:
                            if len(tracks) >= 50:
                                break
                                
                            track_artist = item['artists'][0]['name'].lower()
                            if track_artist in added_artists:
                                continue
                                
                            # Skip suspicious tracks
                            if any(keyword in item['name'].lower() for keyword in 
                                  ['karaoke', 'tribute', 'cover', 'made famous', 'instrumental', 'remake']):
                                continue
                                
                            added_artists.add(track_artist)
                            track_uris.append(item['uri'])
                            tracks.append({
                                'name': item['name'],
                                'artist': item['artists'][0]['name'],
                                'album_image': item['album']['images'][0]['url'] if item['album']['images'] else None
                            })
                except Exception as e:
                    logger.warning(f"Error searching for {genre} tracks: {str(e)}")
            
            logger.info(f"After genre searches, now have {len(tracks)} of 50 tracks")
        
        # Create playlist if we have any tracks
        if not tracks:
            logger.error("Failed to find any tracks for playlist")
            return jsonify({"error": "No tracks found for this playlist description. Please try a different description."}), 400
            
        # Create the playlist
        playlist_title = f"AI Generated: {playlist_description[:30]}..." if len(playlist_description) > 30 else f"AI Generated: {playlist_description}"
        playlist_data = None
        
        try:
            playlist_data = sp.user_playlist_create(
                user=session['user']['id'],
                name=playlist_title,
                public=False,
                description=f"Generated by AI based on: {playlist_description}"
            )
            
            logger.info(f"Created playlist: {playlist_data['id']}")
            
            # Add tracks to playlist - ensure we only add unique URIs
            unique_track_uris = list(dict.fromkeys(track_uris))
            
            # Split into chunks of 100 tracks (Spotify API limit)
            def chunks(lst, n):
                for i in range(0, len(lst), n):
                    yield lst[i:i + n]
                    
            track_uri_chunks = list(chunks(unique_track_uris[:50], 100))  # Only take the first 50
            
            for i, chunk in enumerate(track_uri_chunks):
                sp.playlist_add_items(playlist_data['id'], chunk)
                logger.info(f"Added chunk {i+1}/{len(track_uri_chunks)} ({len(chunk)} tracks) to playlist {playlist_data['id']}")
                
            return jsonify({
                "success": True,
                "playlist_url": playlist_data['external_urls']['spotify'],
                "playlist_name": playlist_data['name'],
                "tracks": tracks[:50]  # Return only the first 50 tracks to the client
            })
            
        except Exception as e:
            logger.error(f"Error creating or populating playlist: {str(e)}")
            logger.exception(e)
            return jsonify({"error": f"Failed to create playlist: {str(e)}"}), 500

    except Exception as e:
        logger.error(f"Error in generate-playlist route: {str(e)}")
        logger.exception(e)
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

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

def search_spotify_track(song_details, sp):
    """
    Search for a song on Spotify and return the best matching track ID.
    
    Args:
        song_details (str): String in format "Song Title by Artist Name"
        sp: Spotify client
        
    Returns:
        dict: Track info with name, artist, id, etc. or None if not found
    """
    try:
        # Parse song details
        parts = song_details.split(' by ', 1)
        if len(parts) != 2:
            logger.warning(f"Couldn't parse song details: {song_details}")
            return None
            
        song_name, artist_name = parts
        song_name = song_name.strip()
        artist_name = artist_name.strip()
        
        # Try exact search first with both title and artist
        query = f"track:{song_name} artist:{artist_name}"
        results = sp.search(q=query, type='track', limit=5)
        
        if results['tracks']['items']:
            track = results['tracks']['items'][0]
            logger.info(f"Found track: {track['name']} by {track['artists'][0]['name']} with ID: {track['id']}")
            return {
                'id': track['id'],
                'name': track['name'],
                'artist': track['artists'][0]['name'],
                'album': track['album']['name'],
                'image_url': track['album']['images'][0]['url'] if track['album']['images'] else None,
                'preview_url': track['preview_url'],
                'artist_id': track['artists'][0]['id'] if track['artists'] else None
            }
        
        # If exact search fails, try a less restrictive search
        query = f"{song_name} {artist_name}"
        results = sp.search(q=query, type='track', limit=10)
        
        if not results['tracks']['items']:
            logger.warning(f"No results found for: {song_details}")
            return None
            
        # Find the best match by comparing artist names
        best_match = None
        for track in results['tracks']['items']:
            track_artist = track['artists'][0]['name'].lower()
            
            # Check if the artist names are similar
            if (track_artist in artist_name.lower() or 
                artist_name.lower() in track_artist or
                fuzz.ratio(track_artist, artist_name.lower()) > 70):
                
                # Get the first match
                if not best_match:
                    best_match = track
                    break
        
        # If no artist match, just take the first result
        if not best_match and results['tracks']['items']:
            best_match = results['tracks']['items'][0]
            
        if best_match:
            logger.info(f"Found best match: {best_match['name']} by {best_match['artists'][0]['name']} with ID: {best_match['id']}")
            return {
                'id': best_match['id'],
                'name': best_match['name'],
                'artist': best_match['artists'][0]['name'],
                'album': best_match['album']['name'],
                'image_url': best_match['album']['images'][0]['url'] if best_match['album']['images'] else None,
                'preview_url': best_match['preview_url'],
                'artist_id': best_match['artists'][0]['id'] if best_match['artists'] else None
            }
        
        return None
        
    except Exception as e:
        logger.error(f"Error searching for track {song_details}: {str(e)}")
        logger.exception(e)
        return None

def generate_song_suggestions(
    prompt, 
    seed_artists=None,
    seed_genres=None, 
    seed_tracks=None,
    analysis=None
):
    """Generate song suggestions using OpenAI"""
    try:
        logger.info(f"Generating song suggestions for prompt: {prompt}")
        
        # Format seed information
        artists_text = f"Some artists you might consider: {', '.join(seed_artists)}. " if seed_artists else ""
        genres_text = f"Some genres to consider: {', '.join(seed_genres)}. " if seed_genres else ""
        tracks_text = f"Some tracks to consider: {', '.join(seed_tracks)}. " if seed_tracks else ""
        
        # Add personality analysis if available
        personality_text = ""
        if analysis and isinstance(analysis, dict):
            traits = []
            for category, score in analysis.items():
                if score > 0.7:  # High score
                    traits.append(f"high {category}")
                elif score < 0.3:  # Low score
                    traits.append(f"low {category}")
            
            if traits:
                personality_text = f"Consider that the user's personality analysis shows: {', '.join(traits)}. "
            
        # Create a detailed system prompt
        system_prompt = """
        You are a music expert with vast knowledge of songs across all genres and time periods.
        You will suggest specific songs based on the user's request.
        For each song, provide the song name and the artist name, formatted consistently as: "Song Name by Artist Name".
        Do not include any explanations, numbering, or additional details - just the list of songs in the specified format.
        Suggest songs that genuinely match the user's request, without making up songs that don't exist.
        """
        
        # Create the user prompt
        user_prompt = f"""
        I need you to create a playlist with at least 75 songs based on this request: "{prompt}".
        {artists_text}
        {genres_text}
        {tracks_text}
        {personality_text}
        Do not include any explanations - only respond with a list of real songs in the format "Song Name by Artist Name", one per line.
        """
        
        logger.info(f"Sending prompt to OpenAI: {user_prompt[:100]}...")
        
        # Call OpenAI API - handle both old and new API versions
        response = openai.ChatCompletion.create(
            model="gpt-4-turbo-preview",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        # Parse the response
        content = response.choices[0].message.content.strip()
        
        logger.info(f"Received response from OpenAI: {len(content)} characters")
        
        # Split the response into individual songs
        songs = [song.strip() for song in content.split('\n') if song.strip()]
        logger.info(f"Extracted {len(songs)} songs from OpenAI response")
        
        return songs
        
    except Exception as e:
        logger.error(f"Error generating song suggestions: {str(e)}")
        logger.exception(e)
        return None

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    app.run(host='0.0.0.0', port=port) 