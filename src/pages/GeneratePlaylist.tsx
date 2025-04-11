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
  Container,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  Stack,
  Divider,
  Avatar,
  useTheme,
  alpha
} from '@mui/material'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import SpotifyIcon from '@mui/icons-material/MusicNote' // We'll use MusicNote as a stand-in for Spotify
import ReplayIcon from '@mui/icons-material/Replay'
import ShareIcon from '@mui/icons-material/Share'
import FavoriteIcon from '@mui/icons-material/Favorite'
import AlbumIcon from '@mui/icons-material/Album'
import AudiotrackIcon from '@mui/icons-material/Audiotrack'

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
  const theme = useTheme()
  const { isAuthenticated, fetchWithAuth, checkAuthStatus } = useAuth()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreview | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Check auth status only once when component mounts
  React.useEffect(() => {
    // Only check auth if we haven't already and don't yet know if user is authenticated
    if (!authChecked && !isAuthenticated) {
      const verifyAuth = async () => {
        const isAuth = await checkAuthStatus();
        setAuthChecked(true);
        if (!isAuth) {
          navigate('/auth');
        }
      };
      verifyAuth();
    }
  }, [authChecked, isAuthenticated, checkAuthStatus, navigate]);

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

  const handleNewPlaylist = () => {
    setPlaylistPreview(null);
    setDescription('');
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
          startIcon={<SpotifyIcon />}
        >
          Login with Spotify
        </Button>
      </Box>
    )
  }

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Box sx={{ 
        mb: 6, 
        textAlign: 'center',
        background: `linear-gradient(to right, ${alpha(theme.palette.primary.main, 0.2)}, transparent)`,
        p: 4,
        borderRadius: 4
      }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography 
            variant="h2" 
            component="h1" 
            gutterBottom
            sx={{ 
              fontWeight: 700,
              background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0px 4px 20px rgba(0, 0, 0, 0.4)',
              mb: 2
            }}
          >
            AI Playlist Generator
          </Typography>
          <Typography 
            variant="h5" 
            color="text.secondary" 
            sx={{ 
              maxWidth: '800px', 
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Describe your perfect playlist, and our AI will curate it for you.
            <br />
            From eras and moods to specific artists and genres - anything goes!
          </Typography>
        </motion.div>
      </Box>

      {!playlistPreview ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              background: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(10px)',
              borderRadius: 4,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              maxWidth: '900px',
              mx: 'auto',
              mb: 6
            }}
          >
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <MusicNoteIcon color="primary" sx={{ fontSize: 30 }} />
              <Typography variant="h4" fontWeight="600">
                Describe Your Playlist
              </Typography>
            </Box>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Try something like "2016 summer hits," "chill lo-fi beats for studying," or "energetic 80s workout mix"
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              label="What kind of playlist do you want?"
              placeholder="For example: 'Upbeat 90s rock songs that remind me of road trips' or '2023 chill pop hits to relax to'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={{ mb: 3 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={loading}
                size="large"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlaylistAddIcon />}
                sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
              >
                {loading ? 'Creating Your Playlist...' : 'Generate Playlist'}
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}
          </Paper>
          
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h6" gutterBottom color="text.secondary">
              Popular Ideas to Try
            </Typography>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={1} 
              justifyContent="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ '& > *': { m: 0.5 } }}
            >
              <Chip 
                label="2010s Summer Hits" 
                color="primary" 
                variant="outlined" 
                onClick={() => setDescription("2010s summer hits that were popular at beach parties")}
              />
              <Chip 
                label="90s R&B Classics" 
                color="primary" 
                variant="outlined" 
                onClick={() => setDescription("Classic 90s R&B songs that defined the era")}
              />
              <Chip 
                label="Indie Folk for Rainy Days" 
                color="primary" 
                variant="outlined" 
                onClick={() => setDescription("Calming indie folk songs perfect for rainy days with a cup of coffee")}
              />
              <Chip 
                label="80s Workout Mix" 
                color="primary" 
                variant="outlined" 
                onClick={() => setDescription("Energetic 80s songs for a retro workout session")}
              />
              <Chip 
                label="2023 Pop Hits" 
                color="primary" 
                variant="outlined" 
                onClick={() => setDescription("Latest pop hits from 2023 that are topping the charts")}
              />
            </Stack>
          </Box>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              borderRadius: 4,
              background: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(10px)',
              mb: 4,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ 
              position: 'absolute', 
              top: 0, 
              right: 0, 
              width: '30%', 
              height: '100%',
              background: `linear-gradient(135deg, transparent 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
              zIndex: 0,
              borderRadius: 4
            }} />
            
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="overline" color="primary">
                    Your New Playlist
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" gutterBottom>
                    {playlistPreview.playlist_name.replace('AI Generated: ', '')}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    Based on: {description}
                  </Typography>
                  <Box sx={{ display: 'flex', mt: 2, gap: 2 }}>
                    <Button
                      variant="contained"
                      href={playlistPreview.playlist_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      startIcon={<SpotifyIcon />}
                    >
                      Open in Spotify
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ReplayIcon />}
                      onClick={handleNewPlaylist}
                    >
                      Create New Playlist
                    </Button>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Share Playlist">
                    <IconButton 
                      color="primary" 
                      size="large"
                      sx={{ 
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                      }}
                    >
                      <ShareIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Add to Favorites">
                    <IconButton 
                      color="primary" 
                      size="large"
                      sx={{ 
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                      }}
                    >
                      <FavoriteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              <Divider sx={{ my: 3 }} />
              
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AudiotrackIcon /> Playlist Songs
              </Typography>
              
              <Grid container spacing={3} sx={{ mt: 1 }}>
                {playlistPreview.tracks.map((track, index) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardMedia
                          component="img"
                          height="200"
                          image={track.album_image || 'https://via.placeholder.com/200?text=Album+Cover'}
                          alt={track.name}
                          sx={{ objectFit: 'cover' }}
                        />
                        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                          <Typography variant="h6" component="div" noWrap title={track.name}>
                            {track.name}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 0.5 
                            }}
                          >
                            <Avatar sx={{ width: 20, height: 20, bgcolor: 'primary.main' }}>
                              <AlbumIcon sx={{ fontSize: 12 }} />
                            </Avatar>
                            {track.artist}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Paper>
        </motion.div>
      )}

      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
        TransitionComponent={Fade}
      >
        <Alert 
          elevation={6} 
          variant="filled" 
          severity="success" 
          onClose={() => setShowSuccess(false)}
        >
          Playlist generated successfully!
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default GeneratePlaylist 