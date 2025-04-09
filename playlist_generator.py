#!/usr/bin/env python3

import os
import json
import time
import spotipy
import openai
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import argparse

# Load environment variables
load_dotenv()

class PlaylistGenerator:
    def __init__(self, prompt, length=10, name=None, interactive=False):
        self.prompt = prompt
        self.length = length
        self.name = name or prompt
        self.interactive = interactive
        self.blacklisted_artists = set()
        self.blacklisted_songs = set()
        
        # Initialize Spotify client
        self.sp = spotipy.Spotify(auth_manager=SpotifyOAuth(
            client_id=os.getenv('SPOTIFY_CLIENT_ID'),
            client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
            redirect_uri=os.getenv('SPOTIFY_REDIRECT_URI'),
            scope='playlist-modify-public playlist-modify-private user-read-private user-read-email'
        ))
        
        # Initialize OpenAI
        openai.api_key = os.getenv('OPENAI_API_KEY')
        
        # Get current user
        self.user = self.sp.current_user()
        self.user_id = self.user['id']
        
    def get_song_suggestions(self):
        """Get song suggestions from ChatGPT"""
        messages = [
            {
                "role": "system",
                "content": "You are a music expert. Suggest specific songs (with artists) that would fit the given prompt. Format the response as JSON with fields: songSuggestions (array of {title, artist}), description (string explaining the selection)."
            },
            {
                "role": "user",
                "content": f"Suggest {self.length} songs for: {self.prompt}"
            }
        ]
        
        if self.blacklisted_artists or self.blacklisted_songs:
            messages.append({
                "role": "user",
                "content": f"Please avoid these artists: {', '.join(self.blacklisted_artists)} and these songs: {', '.join(self.blacklisted_songs)}"
            })
        
        completion = openai.ChatCompletion.create(
            model="gpt-4",
            messages=messages
        )
        
        try:
            response = json.loads(completion.choices[0].message.content)
            return response['songSuggestions']
        except:
            print("Error parsing ChatGPT response")
            return []
    
    def search_spotify(self, song):
        """Search for a song on Spotify"""
        query = f"track:{song['title']} artist:{song['artist']}"
        results = self.sp.search(q=query, type='track', limit=1)
        
        if results['tracks']['items']:
            return results['tracks']['items'][0]
        return None
    
    def create_playlist(self):
        """Create a new playlist"""
        playlist = self.sp.user_playlist_create(
            self.user_id,
            self.name,
            public=True,
            description=f"Generated playlist based on: {self.prompt}"
        )
        return playlist['id']
    
    def add_songs_to_playlist(self, playlist_id, songs):
        """Add songs to the playlist"""
        track_uris = [song['uri'] for song in songs if song]
        if track_uris:
            self.sp.playlist_add_items(playlist_id, track_uris)
    
    def generate_playlist(self):
        """Generate the playlist"""
        print(f"\nGenerating playlist: {self.name}")
        print(f"Prompt: {self.prompt}")
        print(f"Length: {self.length}")
        print(f"Interactive: {self.interactive}\n")
        
        playlist_id = self.create_playlist()
        added_songs = []
        
        while len(added_songs) < self.length:
            suggestions = self.get_song_suggestions()
            
            if not suggestions:
                print("No more suggestions available")
                break
                
            for song in suggestions:
                if len(added_songs) >= self.length:
                    break
                    
                spotify_track = self.search_spotify(song)
                if not spotify_track:
                    print(f"Could not find: {song['title']} by {song['artist']}")
                    continue
                
                if self.interactive:
                    print(f"\n{song['artist']} - {song['title']}")
                    print("[1] Add to Playlist")
                    print("[2] Skip this song")
                    print("[3] Blacklist artist")
                    print("[q] Quit")
                    
                    choice = input("Your choice: ").lower()
                    
                    if choice == '1':
                        added_songs.append(spotify_track)
                    elif choice == '2':
                        self.blacklisted_songs.add(song['title'])
                    elif choice == '3':
                        self.blacklisted_artists.add(song['artist'])
                    elif choice == 'q':
                        break
                else:
                    added_songs.append(spotify_track)
            
            if self.interactive and len(added_songs) < self.length:
                print(f"\nAdded {len(added_songs)} songs so far. Want more?")
                print("[1] Yes, more songs!")
                print("[2] No, I'm done")
                
                if input("Your choice: ") != '1':
                    break
        
        self.add_songs_to_playlist(playlist_id, added_songs)
        print(f"\nPlaylist created with {len(added_songs)} songs!")
        return playlist_id

def main():
    parser = argparse.ArgumentParser(description='Generate Spotify playlists using ChatGPT')
    parser.add_argument('-p', '--prompt', required=True, help='Prompt for playlist generation')
    parser.add_argument('-l', '--length', type=int, default=10, help='Number of songs in playlist')
    parser.add_argument('-n', '--name', help='Playlist name (defaults to prompt)')
    parser.add_argument('-i', '--interactive', action='store_true', help='Enable interactive mode')
    
    args = parser.parse_args()
    
    generator = PlaylistGenerator(
        prompt=args.prompt,
        length=args.length,
        name=args.name,
        interactive=args.interactive
    )
    
    generator.generate_playlist()

if __name__ == '__main__':
    main() 