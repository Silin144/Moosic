import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  Alert,
  Snackbar,
  Grid,
  Chip
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

interface Track {
  name: string
  artist: string
  album_image: string
}

interface PlaylistPreview {
  playlist_url: string
  playlist_name: string
  tracks: Track[]
}

const GeneratePlaylist: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, fetchWithAuth, checkAuthStatus } = useAuth()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreview | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // Check auth status when component mounts
  React.useEffect(() => {
    const verifyAuth = async () => {
      const isAuth = await checkAuthStatus();
      if (!isAuth) {
        navigate('/auth');
      }
    };
    verifyAuth();
  }, [checkAuthStatus, navigate]);

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      navigate('/auth')
      return
    }

    if (!description.trim()) {
      setError('Please describe your playlist')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setPlaylistPreview(null)

      // Use fetchWithAuth instead of fetch
      const response = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/api/generate-playlist`, {
        method: 'POST',
        body: JSON.stringify({ description: description.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate playlist')
      }

      setPlaylistPreview(data)
      setShowSuccess(true)
    } catch (err) {
      console.error('Generate playlist error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate playlist')
      
      // If we got a 401, we need to redirect to auth
      if (err instanceof Error && err.message === 'Not authenticated') {
        navigate('/auth');
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        p={3}
      >
        <Typography variant="h5" gutterBottom>
          Please log in to generate playlists
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/auth')}
          sx={{
            background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
            },
          }}
        >
          Login with Spotify
        </Button>
      </Box>
    )
  }

  return (
    <Box p={3} maxWidth="1200px" mx="auto">
      <Typography variant="h4" gutterBottom>
        Generate Your Playlist
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Describe the kind of playlist you want, and our AI will create it for you!
      </Typography>

      <TextField
        fullWidth
        multiline
        rows={4}
        variant="outlined"
        label="Describe your playlist"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{ mb: 3 }}
      />

      <Button
        variant="contained"
        onClick={handleGenerate}
        disabled={loading}
        sx={{
          background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
          color: 'white',
          padding: '12px 24px',
          fontSize: '1.1rem',
          '&:hover': {
            background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
          },
        }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : 'Generate Playlist'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {playlistPreview && (
        <Box mt={4}>
          <Typography variant="h5" gutterBottom>
            Your Generated Playlist
          </Typography>
          <Typography variant="h6" gutterBottom>
            {playlistPreview.playlist_name}
          </Typography>
          <Button
            variant="contained"
            href={playlistPreview.playlist_url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
              color: 'white',
              mb: 3,
              '&:hover': {
                background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
              },
            }}
          >
            Open in Spotify
          </Button>

          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)'
            },
            gap: 3,
            mt: 4
          }}>
            {playlistPreview.tracks.map((track, index) => (
              <Card key={index} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia
                  component="img"
                  height="140"
                  image={track.album_image}
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
            ))}
          </Box>
        </Box>
      )}

      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
        message="Playlist generated successfully!"
      />
    </Box>
  )
}

export default GeneratePlaylist 