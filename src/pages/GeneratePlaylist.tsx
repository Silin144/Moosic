import React, { useState, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Slider, FormControlLabel, Switch, Alert } from '@mui/material';

const GeneratePlaylist: React.FC = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [length, setLength] = useState(10);
  const [name, setName] = useState('');
  const [interactive, setInteractive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          length,
          name: name || undefined,
          interactive,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate playlist');
      }

      setSuccess('Playlist generated successfully!');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Playlist
      </Typography>

      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="What kind of playlist would you like?"
          value={prompt}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPrompt(e.target.value)}
          margin="normal"
          required
          helperText="Example: 'Peaceful songs to listen to when it's raining'"
        />

        <Box sx={{ mt: 2 }}>
          <Typography gutterBottom>Number of songs: {length}</Typography>
          <Slider
            value={length}
            onChange={(_: Event, value: number | number[]) => setLength(value as number)}
            min={1}
            max={50}
            step={1}
          />
        </Box>

        <TextField
          fullWidth
          label="Playlist Name (optional)"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          margin="normal"
          helperText="Leave blank to use the prompt as the playlist name"
        />

        <FormControlLabel
          control={
            <Switch
              checked={interactive}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInteractive(e.target.checked)}
            />
          }
          label="Interactive Mode"
          sx={{ mt: 2 }}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 3 }}
          disabled={loading || !prompt}
        >
          {loading ? 'Generating...' : 'Generate Playlist'}
        </Button>
      </form>
    </Box>
  );
};

export default GeneratePlaylist; 