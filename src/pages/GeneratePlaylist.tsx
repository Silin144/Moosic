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
  Alert,
  Snackbar,
  Fade,
  Zoom,
  Grow
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'

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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: 'bold',
            mb: 4,
            background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textAlign: 'center',
            fontSize: { xs: '2rem', md: '2.5rem' }
          }}
        >
          Generate Your Playlist
        </Typography>

        <Box 
          sx={{ 
            mb: 4,
            p: { xs: 2, md: 4 },
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
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
              mb: 2
            }}
          />
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={loading}
              sx={{
                width: '100%',
                py: 2,
                background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
                },
                borderRadius: 2,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                textTransform: 'none'
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Generate Playlist'}
            </Button>
          </motion.div>
        </Box>

        {error && (
          <Fade in={true}>
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                borderRadius: 2,
                background: 'rgba(211, 47, 47, 0.1)',
                border: '1px solid rgba(211, 47, 47, 0.2)'
              }}
            >
              {error}
            </Alert>
          </Fade>
        )}

        {preview && (
          <Grow in={true}>
            <Card sx={{ 
              mb: 4, 
              borderRadius: 4,
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.paper' }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {preview.name}
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {preview.description}
                </Typography>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
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
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 'bold'
                    }}
                  >
                    Open in Spotify
                  </Button>
                </motion.div>
              </Box>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Preview Tracks
                </Typography>
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { 
                    xs: '1fr', 
                    sm: '1fr 1fr', 
                    md: '1fr 1fr 1fr' 
                  }, 
                  gap: 3 
                }}>
                  {preview.tracks.map((track, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card sx={{ 
                        height: '100%', 
                        display: 'flex', 
                        flexDirection: 'column',
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 2,
                        overflow: 'hidden'
                      }}>
                        <CardMedia
                          component="img"
                          height="140"
                          image={track.image}
                          alt={track.name}
                          sx={{ objectFit: 'cover' }}
                        />
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography gutterBottom variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                            {track.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {track.artist}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grow>
        )}

        <Snackbar
          open={openSnackbar}
          autoHideDuration={6000}
          onClose={() => setOpenSnackbar(false)}
          TransitionComponent={Zoom}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setOpenSnackbar(false)} 
            severity="success"
            sx={{ 
              width: '100%',
              borderRadius: 2,
              background: 'rgba(46, 125, 50, 0.1)',
              border: '1px solid rgba(46, 125, 50, 0.2)'
            }}
          >
            Playlist generated successfully!
          </Alert>
        </Snackbar>
      </motion.div>
    </Box>
  )
}

export default GeneratePlaylist 