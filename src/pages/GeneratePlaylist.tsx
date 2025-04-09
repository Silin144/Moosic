import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const moods = [
  'Happy',
  'Sad',
  'Energetic',
  'Calm',
  'Motivated',
  'Relaxed',
  'Focused',
  'Nostalgic',
  'Romantic',
  'Angry',
];

const genres = [
  'Pop',
  'Rock',
  'Hip Hop',
  'R&B',
  'Electronic',
  'Jazz',
  'Classical',
  'Country',
  'Indie',
  'Metal',
  'Folk',
  'Blues',
  'Reggae',
  'Soul',
  'Funk',
];

const GeneratePlaylist = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
  };

  const handleGenreSelect = (genre: string) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genre)) {
        return prev.filter((g) => g !== genre);
      }
      if (prev.length < 3) {
        return [...prev, genre];
      }
      return prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMood || selectedGenres.length === 0 || !playlistName) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          mood: selectedMood,
          genres: selectedGenres,
          playlist_name: playlistName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate playlist');
      }

      const data = await response.json();
      if (data.success) {
        navigate('/success');
      } else {
        setError(data.error || 'Failed to generate playlist');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Create Your Playlist
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Select Your Mood
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {moods.map((mood) => (
                <Chip
                  key={mood}
                  label={mood}
                  onClick={() => handleMoodSelect(mood)}
                  color={selectedMood === mood ? 'primary' : 'default'}
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Select Up to 3 Genres
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {genres.map((genre) => (
                <Chip
                  key={genre}
                  label={genre}
                  onClick={() => handleGenreSelect(genre)}
                  color={selectedGenres.includes(genre) ? 'primary' : 'default'}
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ mb: 4 }}>
            <TextField
              fullWidth
              label="Playlist Name"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              required
            />
          </Box>

          {error && (
            <Box sx={{ mb: 4 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              disabled={loading}
              sx={{ minWidth: 200 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate Playlist'}
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={logout}
              sx={{ minWidth: 200 }}
            >
              Logout
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default GeneratePlaylist; 