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
  Badge
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
  const [recommendedPrompts, setRecommendedPrompts] = useState<string[]>([
    "Uplifting indie folk with acoustic guitars",
    "90s hip-hop classics perfect for a road trip",
    "Modern pop hits with female vocalists",
    "Electronic ambient music for deep focus and work",
    "Jazz fusion with elements of funk and soul"
  ])

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
          backgroundImage: 'radial-gradient(circle at 20% 70%, rgba(29, 185, 84, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 40%, rgba(29, 185, 84, 0.03) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: -1,
        }
      }}>
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
                borderRadius: 4,
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

        {/* Recommended For You Section */}
        {!playlistPreview && isAuthenticated && (
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
                borderRadius: 4,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                maxWidth: '900px',
                mx: 'auto',
                mb: 6
              }}
            >
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <SpotifyIcon color="primary" sx={{ fontSize: 30 }} />
                  <Typography variant="h4" fontWeight="600">
                    Recommended For You
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Try these personalized playlist ideas based on your listening habits
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                {recommendedPrompts.map((prompt, index) => (
                  <Box 
                    key={index}
                    sx={{
                      p: 2,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' },
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: (theme) => `0 8px 20px ${alpha(theme.palette.common.black, 0.1)}`,
                        bgcolor: alpha(theme.palette.primary.main, 0.05)
                      }
                    }}
                    onClick={() => {
                      setDescription(prompt);
                      const playlistFormElement = document.getElementById('playlist-form');
                      if (playlistFormElement) {
                        playlistFormElement.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    <Typography variant="subtitle1">{prompt}</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Button 
                        size="small" 
                        variant="text" 
                        startIcon={<PlaylistAddIcon />}
                      >
                        Generate
                      </Button>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSavePrompt(prompt);
                        }}
                      >
                        {isPromptSaved(prompt) ? <BookmarkIcon color="primary" /> : <BookmarkBorderIcon />}
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          </motion.div>
        )}
        
        {/* History Section */}
        {!playlistPreview && playlistHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
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
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <HistoryIcon color="primary" sx={{ fontSize: 30 }} />
                  <Typography variant="h4" fontWeight="600">
                    Recently Generated
                  </Typography>
                </Box>
                <Button 
                  variant="text" 
                  size="small"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? "Show Less" : "View All"}
                </Button>
              </Box>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Your recently created playlists
              </Typography>

              <Box sx={{ mb: 3 }}>
                {(showHistory ? playlistHistory : playlistHistory.slice(0, 3)).map((playlist, index) => (
                  <Box
                    key={playlist.id}
                    sx={{
                      p: 2,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                      borderRadius: 2,
                      mb: 2,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.common.black, 0.1)}`,
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {playlist.name.replace('AI Generated: ', '')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {playlist.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(playlist.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box>
                        <Button
                          variant="contained"
                          size="small"
                          href={playlist.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<SpotifyIcon />}
                          sx={{ borderRadius: 4 }}
                        >
                          Open
                        </Button>
                      </Box>
                    </Box>
                    {playlist.tracks.length > 0 && (
                      <Box sx={{ display: 'flex', mt: 2, gap: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
                        {playlist.tracks.map((track, idx) => (
                          <Box 
                            key={idx} 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              p: 1, 
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.background.paper, 0.4),
                              minWidth: 0,
                              maxWidth: { xs: '100%', sm: '33%' },
                              flex: '1 0 auto'
                            }}
                          >
                            <Avatar 
                              src={track.album_image} 
                              variant="rounded" 
                              sx={{ width: 32, height: 32, mr: 1 }} 
                            />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 'medium' }}>
                                {track.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                {track.artist}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Paper>
          </motion.div>
        )}

        {/* Top Tracks Section - show only when no playlist is being previewed */}
        {!playlistPreview && topTracks.length > 0 && (
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
                borderRadius: 4,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                maxWidth: '900px',
                mx: 'auto',
                mb: 6
              }}
            >
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FavoriteIcon color="primary" sx={{ fontSize: 30 }} />
                  <Typography variant="h4" fontWeight="600">
                    Your Top Tracks
                  </Typography>
                </Box>
                <Button 
                  variant="outlined" 
                  size="small"
                  startIcon={<PlaylistAddIcon />}
                  onClick={() => {
                    setDescription("Create a playlist based on my top tracks with similar vibes");
                    // Scroll to the playlist generation section
                    const playlistFormElement = document.getElementById('playlist-form');
                    if (playlistFormElement) {
                      playlistFormElement.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  Generate Similar Playlist
                </Button>
              </Box>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                These are your most listened tracks on Spotify. Use them as inspiration for your next playlist!
              </Typography>

              {loadingTopTracks ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                  <CircularProgress />
                </Box>
              ) : topTracksError ? (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {topTracksError}
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {topTracks.slice(0, 8).map((track, index) => (
                    <Box 
                      key={track.id}
                      sx={{ 
                        width: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(25% - 16px)' }
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <Card 
                          sx={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            height: '100%',
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: (theme) => `0 8px 20px ${alpha(theme.palette.common.black, 0.15)}`
                            }
                          }}
                        >
                          <Box sx={{ position: 'relative' }}>
                            <CardMedia
                              component="img"
                              height="160"
                              image={track.album_image || 'https://via.placeholder.com/160?text=Album+Cover'}
                              alt={track.name}
                            />
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                bgcolor: 'rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle1" component="div" noWrap title={track.name} fontWeight="medium">
                              {track.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {track.artist}
                            </Typography>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </Box>
                  ))}
                </Box>
              )}
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
                sx={{ mb: 1 }}
              />
              
              {/* Bookmark & Saved prompt controls */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {description.trim() && (
                    <Tooltip title={isPromptSaved(description) ? "Remove from saved" : "Save this prompt"}>
                      <IconButton 
                        size="small" 
                        color="primary" 
                        onClick={() => handleSavePrompt(description)}
                        sx={{ mr: 1 }}
                      >
                        {isPromptSaved(description) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                      </IconButton>
                    </Tooltip>
                  )}
                  
                  <Button 
                    variant="text" 
                    size="small" 
                    startIcon={<BookmarkIcon />}
                    onClick={() => setShowSavedPrompts(!showSavedPrompts)}
                    disabled={savedPrompts.length === 0}
                  >
                    {showSavedPrompts ? "Hide saved" : `Saved prompts (${savedPrompts.length})`}
                  </Button>
                </Box>
                
                <Button
                  variant="text"
                  size="small"
                  startIcon={showTips ? <InfoOutlinedIcon /> : <TuneIcon />}
                  onClick={() => setShowTips(!showTips)}
                >
                  {showTips ? "Hide tips" : "Show tips"}
                </Button>
              </Box>

              {/* Saved prompts dropdown */}
              {showSavedPrompts && savedPrompts.length > 0 && (
                <Paper 
                  elevation={2} 
                  sx={{ 
                    mb: 3, 
                    p: 2,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Your saved prompts:
                  </Typography>
                  <Stack spacing={1}>
                    {savedPrompts.map((prompt, index) => (
                      <Box 
                        key={index}
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1,
                          borderRadius: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                        }}
                        onClick={() => setDescription(prompt)}
                      >
                        <Typography variant="body2" noWrap sx={{ maxWidth: '80%' }}>
                          {prompt}
                        </Typography>
                        <Box>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation()
                              setDescription(prompt)
                            }}
                          >
                            <RepeatIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSavePrompt(prompt)
                            }}
                          >
                            <BookmarkIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                <Typography variant="subtitle1" color="text.secondary">
                  Playlist Options
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Chip 
                    label="15-20 songs" 
                    color="primary" 
                    variant="filled" 
                    sx={{ fontWeight: 'medium' }} 
                  />
                  <Chip 
                    label="No karaoke versions" 
                    color="primary" 
                    variant="filled" 
                    sx={{ fontWeight: 'medium' }} 
                  />
                  <Chip 
                    label="Based on your taste" 
                    color="primary" 
                    variant="filled" 
                    sx={{ fontWeight: 'medium' }} 
                  />
                </Box>
              </Box>

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
                Playlist Creation Tips
              </Typography>
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 3, 
                  background: alpha(theme.palette.background.paper, 0.6),
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                  maxWidth: '900px',
                  mx: 'auto',
                  mb: 4
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, textAlign: 'left' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Better Results
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Be specific about genres, moods, and time periods<br />
                      • Mention activities like "running" or "studying"<br />
                      • Include specific artists as inspiration<br />
                      • Describe the emotional feeling you want
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Try Combining
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Mix genres: "Folk + electronic fusion"<br />
                      • Blend eras: "80s synth with modern vocals"<br />
                      • Specify transitions: "Starting upbeat, ending relaxed"<br />
                      • Cultural mixes: "K-pop meets Latin rhythms"
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Fun Ideas
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Songs that tell a story when played in order<br />
                      • Music from your favorite TV show/movie<br />
                      • A journey through music history by decade<br />
                      • Hidden gems from popular artists
                    </Typography>
                  </Box>
                </Box>
              </Paper>
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
                      <Button
                        variant="outlined"
                        startIcon={<BookmarkBorderIcon />}
                        onClick={() => handleSavePrompt(description)}
                        sx={{ display: { xs: 'none', sm: 'flex' } }}
                      >
                        Save Prompt
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
                    <Tooltip title="More Options">
                      <IconButton 
                        color="primary" 
                        size="large"
                        onClick={handleMenuOpen}
                        sx={{ 
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 3 }} />
                
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AudiotrackIcon /> 
                  Playlist Songs 
                  <Badge 
                    badgeContent={playlistPreview.tracks.length} 
                    color="primary"
                    sx={{ 
                      '& .MuiBadge-badge': { 
                        fontSize: '0.8rem', 
                        height: '22px', 
                        minWidth: '22px',
                        borderRadius: '11px'
                      } 
                    }}
                  />
                </Typography>
                
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  {playlistPreview.tracks.map((track, index) => (
                    <Box 
                      key={index} 
                      sx={{ 
                        width: { xs: '100%', sm: '50%', md: '33.33%', lg: '25%' },
                        padding: 1.5
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <Card 
                          sx={{ 
                            height: '100%', 
                            display: 'flex', 
                            flexDirection: 'column',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-8px)',
                              boxShadow: (theme) => `0 12px 28px ${alpha(theme.palette.common.black, 0.2)}`
                            }
                          }}
                          onMouseEnter={() => setHoverTrack(index)}
                          onMouseLeave={() => setHoverTrack(null)}
                        >
                          <Box sx={{ position: 'relative' }}>
                            <CardMedia
                              component="img"
                              height="200"
                              image={track.album_image || 'https://via.placeholder.com/200?text=Album+Cover'}
                              alt={track.name}
                              sx={{ objectFit: 'cover' }}
                            />
                            {hoverTrack === index && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    bgcolor: 'rgba(0,0,0,0.6)',
                                    borderRadius: '50%',
                                  }}
                                >
                                  <IconButton
                                    size="small"
                                    sx={{ color: 'white' }}
                                  >
                                    <MoreVertIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </motion.div>
                            )}
                          </Box>
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
                    </Box>
                  ))}
                </Grid>
              </Box>
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
              '& .MuiAlert-icon': { fontSize: 20 } 
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
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center'
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Made with <FavoriteIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom', color: '#ff5c8d' }} /> by{' '}
          <Link 
            href="https://silin.ca" 
            target="_blank" 
            rel="noopener noreferrer"
            sx={{ 
              color: 'primary.main',
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
                height: 1,
                bgcolor: 'primary.main',
                transition: 'width 0.3s ease'
              }
            }}
          >
            silin.ca
          </Link>
        </Typography>
      </Box>
    </>
  )
}

export default GeneratePlaylist 