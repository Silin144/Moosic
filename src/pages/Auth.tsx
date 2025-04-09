import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography, Alert } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'

const Auth: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, setIsAuthenticated } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'checking' | 'authenticated' | 'error'>('idle')

  useEffect(() => {
    const checkAuth = async () => {
      setAuthStatus('checking')
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/check-auth`, {
          credentials: 'include'
        })
        const data = await response.json()
        if (data.authenticated) {
          setAuthStatus('authenticated')
          setIsAuthenticated(true)
          navigate('/', { replace: true })
        } else {
          setAuthStatus('idle')
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        setAuthStatus('error')
        setError('Failed to check authentication status')
      }
    }

    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const from = searchParams.get('from')

    if (error) {
      setError(error)
      setAuthStatus('error')
      return
    }

    if (from === 'spotify') {
      checkAuth()
    }
  }, [searchParams, navigate, setIsAuthenticated])

  const handleLogin = () => {
    setLoading(true)
    setError(null)
    setAuthStatus('checking')
    window.location.href = `${import.meta.env.VITE_API_URL}/api/login`
  }

  const LoadingScreen = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={3}
      >
        <CircularProgress size={60} sx={{ color: '#1DB954' }} />
        <Typography variant="h6" color="text.secondary">
          Connecting to Spotify...
        </Typography>
      </Box>
    </motion.div>
  )

  const ErrorScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={3}
        p={3}
      >
        <Alert 
          severity="error" 
          sx={{ 
            width: '100%',
            maxWidth: 400,
            borderRadius: 2,
            background: 'rgba(211, 47, 47, 0.1)',
            border: '1px solid rgba(211, 47, 47, 0.2)'
          }}
        >
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={handleLogin}
          sx={{
            background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
            },
            py: 1.5,
            px: 4,
            fontSize: '1.1rem',
            fontWeight: 'bold',
            borderRadius: 2
          }}
        >
          Try Again
        </Button>
      </Box>
    </motion.div>
  )

  const LoginScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={4}
        p={3}
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
        >
          <Typography 
            variant="h3" 
            gutterBottom
            sx={{
              background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 'bold',
              textAlign: 'center',
              mb: 2
            }}
          >
            Welcome to Moosic
          </Typography>
          <Typography 
            variant="h6" 
            color="text.secondary"
            sx={{ textAlign: 'center', mb: 4 }}
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
      </Box>
    </motion.div>
  )

  if (authStatus === 'checking' || loading) {
    return <LoadingScreen />
  }

  if (authStatus === 'error' || error) {
    return <ErrorScreen />
  }

  return <LoginScreen />
}

export default Auth