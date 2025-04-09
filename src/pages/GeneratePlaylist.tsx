import React, { useState } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Chip,
  Alert,
  Snackbar
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

interface Track {
  name: string
  artist: string
  image: string
}

interface PlaylistPreview {
  name: string
  description: string
  tracks: Track[]
  url: string
}

const GeneratePlaylist: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PlaylistPreview | null>(null)
  const [openSnackbar, setOpenSnackbar] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate playlist')
      }

      const data = await response.json()
      setPreview({
        name: data.name,
        description: data.description,
        tracks: data.tracks || [],
        url: data.playlist_url
      })
      setOpenSnackbar(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Typography variant="h6">Please login to generate playlists</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontWeight: 'bold',
          mb: 4,
          background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        Generate Your Playlist
      </Typography>

      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          multiline
          rows={4}
          variant="outlined"
          label="Describe your perfect playlist"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A playlist for a rainy day with indie folk music"
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'rgba(29, 185, 84, 0.5)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(29, 185, 84, 0.8)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#1DB954',
              },
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={loading}
          sx={{
            mt: 2,
            background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
            },
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Generate Playlist'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {preview && (
        <Card sx={{ mb: 4, borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 3, bgcolor: 'background.paper' }}>
            <Typography variant="h5" gutterBottom>
              {preview.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {preview.description}
            </Typography>
            <Button
              variant="contained"
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
                },
              }}
            >
              Open in Spotify
            </Button>
          </Box>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Preview Tracks
            </Typography>
            <Grid container spacing={2}>
              {preview.tracks.map((track, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardMedia
                      component="img"
                      height="140"
                      image={track.image}
                      alt={track.name}
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography gutterBottom variant="h6" component="div">
                        {track.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {track.artist}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={() => setOpenSnackbar(false)}
        message="Playlist generated successfully!"
      />
    </Box>
  )
}

export default GeneratePlaylist 