import React, { useState } from 'react';
import { Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const moods = ['Happy', 'Sad', 'Energetic', 'Relaxed', 'Motivated', 'Nostalgic'];
const genres = ['Pop', 'Rock', 'Hip Hop', 'Electronic', 'Jazz', 'Classical', 'R&B', 'Country'];
const eras = ['2000s', '2010s', '2020s', '90s', '80s', '70s', '60s'];

const GeneratePlaylist = () => {
  const [mood, setMood] = useState('');
  const [genre, setGenre] = useState('');
  const [era, setEra] = useState('');
  const { logout } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['playlist', mood, genre, era],
    queryFn: async () => {
      if (!mood) return null;
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mood, genre, era }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate playlist');
      }

      return response.json();
    },
    enabled: false,
  });

  const handleGenerate = () => {
    if (mood) {
      refetch();
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Your Playlist
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
        <FormControl fullWidth>
          <InputLabel>Mood</InputLabel>
          <Select
            value={mood}
            label="Mood"
            onChange={(e) => setMood(e.target.value)}
          >
            {moods.map((m) => (
              <MenuItem key={m} value={m.toLowerCase()}>
                {m}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Genre (Optional)</InputLabel>
          <Select
            value={genre}
            label="Genre"
            onChange={(e) => setGenre(e.target.value)}
          >
            <MenuItem value="">Any</MenuItem>
            {genres.map((g) => (
              <MenuItem key={g} value={g.toLowerCase()}>
                {g}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Era (Optional)</InputLabel>
          <Select
            value={era}
            label="Era"
            onChange={(e) => setEra(e.target.value)}
          >
            <MenuItem value="">Any</MenuItem>
            {eras.map((e) => (
              <MenuItem key={e} value={e.toLowerCase()}>
                {e}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={!mood || isLoading}
          sx={{ mt: 2 }}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Generate Playlist'}
        </Button>

        <Button
          variant="outlined"
          onClick={logout}
          sx={{ mt: 2 }}
        >
          Logout
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error.message}
        </Typography>
      )}

      {data && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Your Playlist
          </Typography>
          <Typography variant="body1">
            Playlist created successfully! Check your Spotify account.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default GeneratePlaylist; 