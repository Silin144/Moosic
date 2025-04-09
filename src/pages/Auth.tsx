import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography, Alert, Container, Paper } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { styled } from '@mui/material/styles'

const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 'bold',
}))

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: 16,
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
}))

const Auth: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, setIsAuthenticated } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'checking' | 'authenticated' | 'error'>('idle')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthStatus('checking')
        console.log('Checking authentication status...')
        
        // Clear any existing tokens and session data
        localStorage.removeItem('token')
        sessionStorage.clear()
        
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/check-auth`, {
          credentials: 'include'
        })
        
        console.log('Auth check response:', response.status)
        const data = await response.json()
        console.log('Auth check data:', data)
        
        if (data.authenticated) {
          localStorage.setItem('token', 'authenticated')
          setIsAuthenticated(true)
          setAuthStatus('authenticated')
          navigate('/')
        } else {
          setAuthStatus('idle')
        }
      } catch (err) {
        console.error('Auth check error:', err)
        setAuthStatus('error')
        setError('Failed to check authentication status')
      }
    }

    const params = new URLSearchParams(location.search)
    const fromSpotify = params.get('from') === 'spotify'
    const error = params.get('error')

    if (error) {
      console.error('Spotify auth error:', error)
      setAuthStatus('error')
      setError(error)
      return
    }

    if (fromSpotify) {
      checkAuth()
    } else if (isAuthenticated) {
      navigate('/')
    }
  }, [location, navigate, isAuthenticated, setIsAuthenticated])

  const handleLogin = () => {
    // Clear all existing data
    localStorage.clear();
    sessionStorage.clear();
    setAuthStatus('checking');
    setError(null);
    
    // Add a small delay to ensure cleanup is complete
    setTimeout(() => {
      window.location.href = `${import.meta.env.VITE_API_URL}/api/login`;
    }, 100);
  };

  const handleRetry = () => {
    // Clear all existing data
    localStorage.clear();
    sessionStorage.clear();
    setError(null);
    setAuthStatus('idle');
    
    // Add a small delay to ensure cleanup is complete
    setTimeout(() => {
      handleLogin();
    }, 100);
  };

  const LoadingScreen = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Container maxWidth="sm">
        <StyledPaper elevation={3}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <CircularProgress size={60} sx={{ color: '#1DB954' }} />
            </motion.div>
            <Typography variant="h6" color="text.secondary" align="center">
              Connecting to Spotify...
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Please wait while we set up your personalized music experience
            </Typography>
          </Box>
        </StyledPaper>
      </Container>
    </motion.div>
  )

  const ErrorScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Container maxWidth="sm">
        <StyledPaper elevation={3}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
            <Alert 
              severity="error" 
              sx={{ 
                width: '100%',
                borderRadius: 2,
                background: 'rgba(211, 47, 47, 0.1)',
                border: '1px solid rgba(211, 47, 47, 0.2)'
              }}
            >
              {error}
            </Alert>
            <Button 
              variant="contained" 
              onClick={handleRetry}
              sx={{
                background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
                },
                py: 1.5,
                px: 4,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: '0 4px 14px 0 rgba(29, 185, 84, 0.39)'
              }}
            >
              Try Again
            </Button>
          </Box>
        </StyledPaper>
      </Container>
    </motion.div>
  )

  const LoginScreen = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #121212 0%, #1DB954 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
    >
      <Container maxWidth="sm">
        <StyledPaper elevation={3}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={4}>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              <GradientText variant="h3" gutterBottom align="center">
                Welcome to Moosic
              </GradientText>
              <Typography 
                variant="h6" 
                color="text.secondary"
                align="center"
                sx={{ mb: 4 }}
              >
                Create personalized playlists with AI
              </Typography>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="contained"
                onClick={handleLogin}
                disabled={loading}
                sx={{
                  background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
                  },
                  py: 2,
                  px: 6,
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  borderRadius: 2,
                  textTransform: 'none',
                  boxShadow: '0 4px 14px 0 rgba(29, 185, 84, 0.39)'
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Login with Spotify'}
              </Button>
            </motion.div>

            <Typography 
              variant="body2" 
              color="text.secondary"
              align="center"
              sx={{ mt: 2 }}
            >
              By logging in, you agree to our Terms of Service and Privacy Policy
            </Typography>
          </Box>
        </StyledPaper>
      </Container>
    </motion.div>
  )

  return (
    <AnimatePresence mode="wait">
      {authStatus === 'checking' || loading ? (
        <LoadingScreen />
      ) : authStatus === 'error' || error ? (
        <ErrorScreen />
      ) : (
        <LoginScreen />
      )}
    </AnimatePresence>
  )
}

export default Auth