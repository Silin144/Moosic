import React, { useState, useEffect } from 'react'
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
  alpha,
  Link,
  Badge,
  useMediaQuery
} from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import SpotifyIcon from '@mui/icons-material/MusicNote' // We'll use MusicNote as a stand-in for Spotify
import ReplayIcon from '@mui/icons-material/Replay'
import ShareIcon from '@mui/icons-material/Share'
import FavoriteIcon from '@mui/icons-material/Favorite'
import AlbumIcon from '@mui/icons-material/Album'
import AudiotrackIcon from '@mui/icons-material/Audiotrack'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SlideshowIcon from '@mui/icons-material/Slideshow'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PauseIcon from '@mui/icons-material/Pause'
import LockIcon from '@mui/icons-material/Lock'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TuneIcon from '@mui/icons-material/Tune'
import RepeatIcon from '@mui/icons-material/Repeat'
import HistoryIcon from '@mui/icons-material/History'
import MusicVideoIcon from '@mui/icons-material/MusicVideo'
import HeadphonesIcon from '@mui/icons-material/Headphones'
import LightbulbIcon from '@mui/icons-material/Lightbulb'

interface Track {
  name: string
  artist: string
  album_image: string
}

interface TopTrack {
  id: string
  name: string
  artist: string
  album_image: string
  preview_url: string | null
}

interface PlaylistPreview {
  playlist_url: string
  playlist_name: string
  tracks: Track[]
}

interface PlaylistHistory {
  id: string
  description: string
  name: string
  url: string
  createdAt: number
  tracks: Track[]
}

const GeneratePlaylist: React.FC = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { isAuthenticated, fetchWithAuth, checkAuthStatus } = useAuth()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreview | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [hoverTrack, setHoverTrack] = useState<number | null>(null)
  const [topTracks, setTopTracks] = useState<TopTrack[]>([])
  const [loadingTopTracks, setLoadingTopTracks] = useState(false)
  const [topTracksError, setTopTracksError] = useState<string | null>(null)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [savedPrompts, setSavedPrompts] = useState<string[]>([])
  const [showSavedPrompts, setShowSavedPrompts] = useState<boolean>(false)
  const [showTips, setShowTips] = useState<boolean>(true)
  const [playlistHistory, setPlaylistHistory] = useState<PlaylistHistory[]>([])
  const [showHistory, setShowHistory] = useState<boolean>(false)

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

  // Fetch user's top tracks when authenticated
  useEffect(() => {
    const fetchTopTracks = async () => {
      if (!isAuthenticated) return;
      
      try {
        setLoadingTopTracks(true);
        setTopTracksError(null);
        setNeedsReauth(false);
        
        const response = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/api/user/top-tracks`);
        
        if (!response.ok) {
          // If we get a 401 or 403, handle accordingly
          if (response.status === 401 || response.status === 403) {
            setTopTracks([]);
            // Check error details
            const data = await response.json();
            if (data.code === 'insufficient_scope' || 
                (data.error && (
                  data.error.includes('Insufficient client scope') || 
                  data.error.includes('reauthorize')
                ))) {
              setNeedsReauth(true);
            }
            return;
          }
          throw new Error('Failed to fetch top tracks');
        }
        
        const data = await response.json();
        setTopTracks(data.tracks || []);
      } catch (err) {
        console.error('Error fetching top tracks:', err);
        // Don't set error state for auth errors - just treat as empty tracks
        if (err instanceof Error && !err.message.includes('authenticated')) {
          setTopTracksError(err instanceof Error ? err.message : 'Failed to fetch top tracks');
        }
      } finally {
        setLoadingTopTracks(false);
      }
    };
    
    fetchTopTracks();
  }, [isAuthenticated, fetchWithAuth]);

  // Load saved prompts from localStorage
  useEffect(() => {
    const loadedPrompts = localStorage.getItem('savedPrompts')
    if (loadedPrompts) {
      try {
        setSavedPrompts(JSON.parse(loadedPrompts))
      } catch (e) {
        console.error('Failed to parse saved prompts', e)
      }
    }
  }, [])

  // Load playlist history from localStorage
  useEffect(() => {
    const loadedHistory = localStorage.getItem('playlistHistory')
    if (loadedHistory) {
      try {
        setPlaylistHistory(JSON.parse(loadedHistory))
      } catch (e) {
        console.error('Failed to parse playlist history', e)
      }
    }
  }, [])

  // Save prompt to localStorage
  const handleSavePrompt = (prompt: string) => {
    if (!prompt.trim()) return
    
    const newSavedPrompts = [...savedPrompts]
    
    // If prompt already exists, remove it (toggle behavior)
    const existingIndex = newSavedPrompts.indexOf(prompt)
    if (existingIndex >= 0) {
      newSavedPrompts.splice(existingIndex, 1)
    } else {
      // Otherwise add it
      newSavedPrompts.push(prompt)
    }
    
    setSavedPrompts(newSavedPrompts)
    localStorage.setItem('savedPrompts', JSON.stringify(newSavedPrompts))
    setShowSuccess(true)
  }

  const isPromptSaved = (prompt: string) => {
    return savedPrompts.includes(prompt)
  }

  const handlePlayPreview = (trackId: string, previewUrl: string | null) => {
    if (!previewUrl) return;
    
    if (currentlyPlaying === trackId) {
      // Stop playing
      const audioElements = document.getElementsByTagName('audio');
      for (let i = 0; i < audioElements.length; i++) {
        audioElements[i].pause();
      }
      setCurrentlyPlaying(null);
    } else {
      // Stop any currently playing audio
      const audioElements = document.getElementsByTagName('audio');
      for (let i = 0; i < audioElements.length; i++) {
        audioElements[i].pause();
      }
      
      // Play the new track
      const audio = new Audio(previewUrl);
      audio.play();
      audio.addEventListener('ended', () => setCurrentlyPlaying(null));
      setCurrentlyPlaying(trackId);
    }
  };

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
      
      // Save to history when playlist is successfully generated
      saveToHistory(data, description.trim())
      
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const copyPlaylistLink = () => {
    if (playlistPreview?.playlist_url) {
      navigator.clipboard.writeText(playlistPreview.playlist_url)
      setShowSuccess(true)
      handleMenuClose()
    }
  }

  // Function to handle reauthorization
  const handleReauthorize = async () => {
    try {
      // First, log out the user from the backend
      const response = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/api/logout`);
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      
      // Clear any local storage that might be related to authentication
      localStorage.clear();
      sessionStorage.clear();
      
      // Small delay to ensure backend processes the logout
      setTimeout(() => {
        // Then redirect to auth page with special parameter to force permission prompt
        window.location.href = '/auth?force_permissions=true';
      }, 500);
    } catch (error) {
      console.error('Error during reauthorization:', error);
      // If the logout fails, still try to redirect
      window.location.href = '/auth?force_permissions=true';
    }
  };

  // Save a new playlist to history
  const saveToHistory = (playlist: PlaylistPreview, promptDescription: string) => {
    const newHistoryItem: PlaylistHistory = {
      id: Date.now().toString(),
      description: promptDescription,
      name: playlist.playlist_name,
      url: playlist.playlist_url,
      createdAt: Date.now(),
      tracks: playlist.tracks.slice(0, 3) // Only save first 3 tracks for preview
    }
    
    const newHistory = [newHistoryItem, ...playlistHistory].slice(0, 10) // Keep only the most recent 10
    setPlaylistHistory(newHistory)
    localStorage.setItem('playlistHistory', JSON.stringify(newHistory))
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
    <>
      <Container maxWidth="xl" sx={{ 
        py: 6,
        position: 'relative',
        minHeight: 'calc(100vh - 80px)', // Adjust for footer
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background: 'linear-gradient(135deg, rgba(29,185,84,0.08) 0%, rgba(30,215,96,0.03) 100%)',
          zIndex: -1,
        }
      }}>
        <Box sx={{ 
          mb: 6, 
          position: 'relative',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(29,185,84,0.3) 0%, rgba(30,215,96,0.1) 100%)',
          p: { xs: 3, md: 4 },
          pt: { xs: 6, md: 8 },
          pb: { xs: 8, md: 10 },
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        }}>
          {/* Animated background elements */}
          <Box sx={{ 
            position: 'absolute', 
            top: '-10%', 
            left: '-5%', 
            width: '120%', 
            height: '120%', 
            zIndex: -1,
            opacity: 0.6,
            background: 'radial-gradient(circle at 30% 30%, rgba(29,185,84,0.4) 0%, transparent 25%), radial-gradient(circle at 70% 70%, rgba(30,215,96,0.3) 0%, transparent 25%)'
          }} />
          
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, type: 'spring' }}
          >
            <Typography 
              variant={isMobile ? "h3" : "h1"} 
              component="h1" 
              gutterBottom
              sx={{ 
                fontWeight: 800,
                background: 'linear-gradient(90deg, #1DB954 0%, #1ED760 50%, #1DB954 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% auto',
                animation: 'gradient 5s ease infinite',
                textShadow: '0px 5px 25px rgba(0, 0, 0, 0.4)',
                mb: 2,
                '@keyframes gradient': {
                  '0%': { backgroundPosition: '0% center' },
                  '50%': { backgroundPosition: '100% center' },
                  '100%': { backgroundPosition: '0% center' },
                }
              }}
            >
              Spotify Playlist AI
            </Typography>
            
            <Typography 
              variant="h5" 
              color="text.secondary" 
              sx={{ 
                maxWidth: '900px', 
                mx: 'auto',
                lineHeight: 1.6,
                fontWeight: 500,
                fontSize: { xs: '1.1rem', md: '1.3rem' },
                px: { xs: 1, md: 4 }
              }}
            >
              Describe your perfect playlist and our AI will create it for you using Spotify's 
              <Box component="span" sx={{ 
                color: theme.palette.primary.main, 
                fontWeight: 700,
                px: 1
              }}>50 million+ tracks</Box>
            </Typography>
            
            {/* Animated music notes */}
            <Box sx={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  style={{
                    position: 'absolute',
                    x: `${Math.random() * 90 + 5}%`,
                    y: `${Math.random() * 90 + 5}%`,
                    opacity: 0.4
                  }}
                  animate={{
                    y: [
                      `${Math.random() * 90 + 5}%`, 
                      `${Math.random() * 20}%`
                    ],
                    opacity: [0.4, 0.7, 0],
                    scale: [1, 1.2, 0.8, 0]
                  }}
                  transition={{
                    duration: 10 + Math.random() * 20,
                    repeat: Infinity,
                    repeatType: 'loop',
                    ease: 'easeInOut'
                  }}
                >
                  {i % 3 === 0 ? (
                    <MusicNoteIcon 
                      sx={{ 
                        fontSize: 30 + Math.random() * 30,
                        color: alpha('#1DB954', 0.6)
                      }} 
                    />
                  ) : i % 3 === 1 ? (
                    <HeadphonesIcon 
                      sx={{ 
                        fontSize: 25 + Math.random() * 20,
                        color: alpha('#1DB954', 0.5)
                      }} 
                    />
                  ) : (
                    <MusicVideoIcon 
                      sx={{ 
                        fontSize: 25 + Math.random() * 20,
                        color: alpha('#1DB954', 0.5) 
                      }} 
                    />
                  )}
                </motion.div>
              ))}
            </Box>
          </motion.div>
        </Box>

        {/* Re-authorization notice - show only when needed */}
        {!playlistPreview && needsReauth && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Paper 
              elevation={3} 
              sx={{ 
                p: 4, 
                background: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                maxWidth: '900px',
                mx: 'auto',
                mb: 6
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <LockIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h5" fontWeight="600" gutterBottom>
                  Additional Permissions Needed
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: '600px' }}>
                  To view your top tracks, we need additional Spotify permissions. Please reauthorize the app to enable this feature.
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleReauthorize}
                  startIcon={<SpotifyIcon />}
                  sx={{ px: 4 }}
                >
                  Reauthorize with Spotify
                </Button>
              </Box>
            </Paper>
          </motion.div>
        )}

        {/* Top Tracks Section - show always below the playlist generator/preview */}
        {topTracks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper 
              elevation={3} 
              sx={{ 
                p: { xs: 3, md: 5 }, 
                background: 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.04) 100%)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                maxWidth: '1200px',
                mx: 'auto',
                mb: 8,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Background decoration */}
              <Box sx={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'radial-gradient(circle at 20% 30%, rgba(29,185,84,0.07) 0%, transparent 30%)',
                zIndex: 0
              }} />
              
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ 
                  mb: 4, 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: { xs: 'flex-start', md: 'center' },
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 2
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ position: 'relative' }}>
                      <FavoriteIcon 
                        color="primary" 
                        sx={{ 
                          fontSize: { xs: 30, md: 35 } 
                        }} 
                      />
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          repeatType: "loop"
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          backgroundColor: theme.palette.primary.main,
                          zIndex: -1
                        }}
                      />
                    </Box>
                    <Typography 
                      variant="h4" 
                      fontWeight="700"
                      sx={{ fontSize: { xs: '1.8rem', md: '2.2rem' } }}
                    >
                      Your Favorite Tracks
                    </Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    size="medium"
                    startIcon={<PlaylistAddIcon />}
                    onClick={() => {
                      setDescription("Create a playlist inspired by my top tracks with similar vibes but also some fresh discoveries");
                      // Scroll to the playlist generation section
                      const playlistFormElement = document.getElementById('playlist-form');
                      if (playlistFormElement) {
                        playlistFormElement.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    sx={{ 
                      borderRadius: '12px',
                      backgroundColor: alpha(theme.palette.primary.main, 0.85),
                      '&:hover': {
                        backgroundColor: theme.palette.primary.main
                      }
                    }}
                  >
                    Create Playlist From These
                  </Button>
                </Box>
                
                <Typography 
                  variant="body1" 
                  color="text.secondary" 
                  sx={{ 
                    mb: 4,
                    maxWidth: '900px',
                    fontSize: { xs: '1rem', md: '1.1rem' }
                  }}
                >
                  These are your most listened tracks on Spotify. Get inspired by your listening habits or create a playlist with similar vibes.
                </Typography>

                {loadingTopTracks ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 6, height: '200px', alignItems: 'center' }}>
                    <CircularProgress color="primary" />
                  </Box>
                ) : topTracksError ? (
                  <Alert severity="error" sx={{ mb: 4, borderRadius: '12px' }}>
                    {topTracksError}
                  </Alert>
                ) : (
                  <Grid container spacing={3} component="div">
                    {topTracks.slice(0, 8).map((track, index) => (
                      <Grid 
                        key={track.id}
                        component="div"
                        size={{ xs: 12, sm: 6, md: 3 }}
                      >
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                        >
                          <Card 
                            sx={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              height: '100%',
                              borderRadius: '16px',
                              transition: 'all 0.3s ease',
                              boxShadow: '0 6px 15px rgba(0,0,0,0.07)',
                              overflow: 'hidden',
                              '&:hover': {
                                transform: 'translateY(-8px)',
                                boxShadow: '0 12px 25px rgba(0,0,0,0.12)'
                              }
                            }}
                          >
                            <Box sx={{ position: 'relative' }}>
                              <CardMedia
                                component="img"
                                height="180"
                                image={track.album_image || 'https://via.placeholder.com/180?text=Album+Cover'}
                                alt={track.name}
                                sx={{ objectFit: 'cover' }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(0,0,0,0.3)',
                                  opacity: 0,
                                  transition: 'opacity 0.3s ease',
                                  '&:hover': {
                                    opacity: 1
                                  }
                                }}
                              >
                                {track.preview_url && (
                                  <IconButton
                                    onClick={() => handlePlayPreview(track.id, track.preview_url)}
                                    sx={{ 
                                      color: 'white',
                                      bgcolor: 'rgba(0,0,0,0.4)',
                                      '&:hover': {
                                        bgcolor: 'rgba(0,0,0,0.6)'
                                      }
                                    }}
                                  >
                                    {currentlyPlaying === track.id ? <PauseIcon /> : <PlayArrowIcon />}
                                  </IconButton>
                                )}
                              </Box>
                            </Box>
                            <CardContent sx={{ flexGrow: 1, pt: 2 }}>
                              <Typography 
                                variant="subtitle1" 
                                component="div" 
                                gutterBottom 
                                noWrap 
                                title={track.name} 
                                fontWeight="600"
                              >
                                {track.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {track.artist}
                              </Typography>
                              {currentlyPlaying === track.id && (
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: '100%' }}
                                  transition={{ duration: 30, ease: 'linear' }}
                                  style={{
                                    height: 3,
                                    backgroundColor: theme.palette.primary.main,
                                    marginTop: 8,
                                    borderRadius: 2
                                  }}
                                />
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            </Paper>
          </motion.div>
        )}

        {!playlistPreview ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper 
              id="playlist-form"
              elevation={3} 
              sx={{ 
                p: { xs: 3, md: 4 }, 
                background: 'rgba(15, 24, 16, 0.9)',
                borderRadius: '12px',
                border: '1px solid rgba(29, 185, 84, 0.2)',
                maxWidth: '700px',
                mx: 'auto',
                mb: 4,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                color: 'rgba(255, 255, 255, 0.9)'
              }}
            >
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography 
                  variant="h5" 
                  fontWeight="bold" 
                  gutterBottom
                  sx={{ mb: 3, color: 'rgba(255, 255, 255, 0.95)' }}
                >
                  Create Your Playlist
                </Typography>
                
                <TextField
                  label="Describe your playlist"
                  placeholder="Example: Upbeat indie folk songs for a road trip through California"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      backgroundColor: 'rgba(15, 24, 16, 0.7)',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.9)',
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#1DB954',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#1DB954',
                        borderWidth: 2
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(29, 185, 84, 0.5)'
                      }
                    },
                    '& .MuiInputLabel-outlined': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': {
                        color: '#1DB954'
                      }
                    },
                    '& .MuiInputBase-input::placeholder': {
                      color: 'rgba(255, 255, 255, 0.5)',
                      opacity: 1
                    }
                  }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    onClick={handleGenerate}
                    disabled={loading || !description.trim()}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlaylistAddIcon />}
                    sx={{ 
                      py: 1.2,
                      px: 4,
                      borderRadius: '8px',
                      fontWeight: 600
                    }}
                  >
                    {loading ? 'Generating...' : 'Generate Playlist'}
                  </Button>
                  
                  <Button
                    variant="text"
                    onClick={() => setShowTips(!showTips)}
                    sx={{ color: 'text.secondary' }}
                  >
                    {showTips ? 'Hide Tips' : 'Show Tips'}
                  </Button>
                </Box>
                
                {error && (
                  <Alert severity="error" sx={{ mt: 2, borderRadius: '8px' }}>
                    {error}
                  </Alert>
                )}
                
                {showTips && (
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      background: 'rgba(29, 185, 84, 0.1)',
                      borderRadius: '8px',
                      mt: 3,
                      border: '1px solid rgba(29, 185, 84, 0.2)'
                    }}
                  >
                    <Typography variant="subtitle2" color="rgba(255, 255, 255, 0.8)" gutterBottom>
                      Try something like:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      <Chip 
                        label="2010s summer hits" 
                        size="small"
                        onClick={() => setDescription("2010s summer hits that were popular at beach parties")}
                        sx={{ 
                          backgroundColor: 'rgba(29, 185, 84, 0.2)', 
                          color: 'rgba(255, 255, 255, 0.9)',
                          '&:hover': { backgroundColor: 'rgba(29, 185, 84, 0.3)' } 
                        }}
                      />
                      <Chip 
                        label="90s R&B classics" 
                        size="small"
                        onClick={() => setDescription("Classic 90s R&B songs that defined the era")}
                        sx={{ 
                          backgroundColor: 'rgba(29, 185, 84, 0.2)', 
                          color: 'rgba(255, 255, 255, 0.9)',
                          '&:hover': { backgroundColor: 'rgba(29, 185, 84, 0.3)' } 
                        }}
                      />
                      <Chip 
                        label="Indie folk for rainy days" 
                        size="small"
                        onClick={() => setDescription("Calming indie folk songs perfect for rainy days with a cup of coffee")}
                        sx={{ 
                          backgroundColor: 'rgba(29, 185, 84, 0.2)', 
                          color: 'rgba(255, 255, 255, 0.9)',
                          '&:hover': { backgroundColor: 'rgba(29, 185, 84, 0.3)' } 
                        }}
                      />
                    </Box>
                  </Paper>
                )}
              </Box>
            </Paper>
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
                p: { xs: 3, md: 4 }, 
                borderRadius: '12px',
                background: '#fff',
                mb: 6,
                maxWidth: '700px',
                mx: 'auto',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
              }}
            >  
              {playlistPreview && (
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Box sx={{ mb: 3 }}>
                    <Typography 
                      variant="h5" 
                      fontWeight="bold" 
                      gutterBottom
                    >
                      {playlistPreview.playlist_name.replace('AI Generated: ', '')}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Based on: {description}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', mt: 3, gap: 2 }}>
                      <Button
                        variant="contained"
                        href={playlistPreview.playlist_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<SpotifyIcon />}
                        sx={{ 
                          borderRadius: '8px',
                        }}
                      >
                        Open in Spotify
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<ReplayIcon />}
                        onClick={handleNewPlaylist}
                        sx={{ borderRadius: '8px' }}
                      >
                        New Playlist
                      </Button>
                    </Box>
                  </Box>
                  
                  <Divider sx={{ my: 3 }} />
                  
                  <Typography variant="h6" gutterBottom>
                    Playlist Songs ({playlistPreview.tracks.length})
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ mt: 1 }} component="div">
                    {playlistPreview.tracks.slice(0, 8).map((track, index) => (
                      <Grid 
                        key={index}
                        component="div"
                        size={{ xs: 12, sm: 6 }}
                      >
                        <Card 
                          sx={{ 
                            display: 'flex',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: 'none',
                            border: '1px solid #eee',
                          }}
                        >
                          <CardMedia
                            component="img"
                            sx={{ width: 60, height: 60 }}
                            image={track.album_image || 'https://via.placeholder.com/60?text=Album'}
                            alt={track.name}
                          />
                          <Box sx={{ display: 'flex', flexDirection: 'column', pl: 2, pr: 1, py: 1, flex: 1, overflow: 'hidden' }}>
                            <Typography variant="subtitle2" noWrap component="div" title={track.name}>
                              {track.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {track.artist}
                            </Typography>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                  
                  {playlistPreview.tracks.length > 8 && (
                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                      <Button 
                        variant="text" 
                        color="primary"
                        href={playlistPreview.playlist_url}
                        target="_blank"
                      >
                        See all {playlistPreview.tracks.length} songs on Spotify
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </Paper>
          </motion.div>
        )}

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={copyPlaylistLink}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Copy Playlist Link</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleMenuClose}>
            <ListItemIcon>
              <SlideshowIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Preview Playlist</ListItemText>
          </MenuItem>
        </Menu>

        <Snackbar
          open={showSuccess}
          autoHideDuration={4000}
          onClose={() => setShowSuccess(false)}
          TransitionComponent={Fade}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            elevation={6} 
            variant="filled" 
            severity="success" 
            onClose={() => setShowSuccess(false)}
            sx={{ 
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
              '& .MuiAlert-icon': { fontSize: 20 },
              borderRadius: '12px'
            }}
          >
            {playlistPreview ? 'Link copied to clipboard!' : 'Playlist generated successfully!'}
          </Alert>
        </Snackbar>
      </Container>

      {/* Footer with portfolio attribution */}
      <Box
        component="footer"
        sx={{
          py: 4,
          px: 2,
          mt: 'auto',
          backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid',
          borderTopColor: 'divider',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative wave background */}
        <Box 
          sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%231DB954' fill-opacity='0.05' d='M0,32L48,58.7C96,85,192,139,288,154.7C384,171,480,149,576,144C672,139,768,149,864,170.7C960,192,1056,224,1152,218.7C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
        
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="body1" 
              color="text.secondary"
              sx={{ 
                fontSize: { xs: '0.9rem', md: '1rem' },
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              Made with{' '}
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                }}
                transition={{ 
                  duration: 1,
                  repeat: Infinity,
                  repeatType: 'loop',
                  repeatDelay: 1.5
                }}
              >
                <FavoriteIcon 
                  sx={{ 
                    fontSize: 18, 
                    color: '#ff5c8d',
                    verticalAlign: 'text-bottom',
                  }} 
                />
              </motion.div>
              {' '}by{' '}
              <Link 
                href="https://silin.ca" 
                target="_blank" 
                rel="noopener noreferrer"
                sx={{ 
                  color: theme.palette.primary.main,
                  fontWeight: 600,
                  textDecoration: 'none',
                  position: 'relative',
                  '&:hover': {
                    textDecoration: 'none',
                    '&::after': {
                      width: '100%'
                    }
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: -2,
                    left: 0,
                    width: 0,
                    height: 2,
                    bgcolor: theme.palette.primary.main,
                    transition: 'width 0.3s ease'
                  }
                }}
              >
                silin.ca
              </Link>
            </Typography>
          </motion.div>
        </Box>
      </Box>
    </>
  )
}

export default GeneratePlaylist 