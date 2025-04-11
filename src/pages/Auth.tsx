import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc, x) => acc + possible[x % possible.length], "")
}

const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const Auth: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setIsAuthenticated } = useAuth()
  const [authStatus, setAuthStatus] = useState<'idle' | 'checking' | 'authenticated' | 'error'>('idle')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthStatus('checking')
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/check-auth`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to check authentication status')
        }
        
        const data = await response.json()
        
        if (data.authenticated) {
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

    // Check URL parameters for auth response
    const params = new URLSearchParams(location.search)
    if (params.get('auth') === 'success') {
      checkAuth() // Re-check auth status after successful redirect
    } else if (params.get('auth') === 'error') {
      setAuthStatus('error')
      setError(params.get('message') || 'Authentication failed')
    } else {
      checkAuth()
    }
  }, [location, navigate, setIsAuthenticated])

  const handleLogin = async () => {
    try {
      // Generate a random state parameter
      const state = generateRandomString(16)
      // Store state in sessionStorage (more secure than localStorage)
      sessionStorage.setItem('spotify_auth_state', state)

      // Clear any existing session data
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      })

      // Redirect to Spotify authorization endpoint
      const authUrl = new URL('https://accounts.spotify.com/authorize')
      const params = {
        client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
        scope: 'playlist-modify-public playlist-modify-private user-read-private user-read-email',
        state: state,
        show_dialog: 'true'
      }
      
      authUrl.search = new URLSearchParams(params).toString()
      window.location.href = authUrl.toString()
    } catch (err) {
      console.error('Login error:', err)
      setAuthStatus('error')
      setError('Failed to initialize login')
    }
  }

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      
      if (error) {
        setAuthStatus('error')
        setError(error)
        return
      }
      
      // Verify state parameter
      const storedState = sessionStorage.getItem('spotify_auth_state')
      if (!state || !storedState || state !== storedState) {
        console.error('State mismatch:', { received: state, stored: storedState })
        setAuthStatus('error')
        setError('State mismatch')
        return
      }
      
      // Clear the state from sessionStorage
      sessionStorage.removeItem('spotify_auth_state')
      
      if (code) {
        try {
          // Make a POST request to our backend to exchange the code for tokens
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
              state: state // Send the state to the backend for verification
            }),
            credentials: 'include'
          })

          if (!response.ok) {
            throw new Error('Failed to exchange code for token')
          }

          // Redirect to success page
          window.location.href = `${window.location.origin}/auth?auth=success`
        } catch (err) {
          console.error('Callback error:', err)
          setAuthStatus('error')
          setError('Failed to handle callback')
        }
      }
    }
    
    handleCallback()
  }, [])

  if (authStatus === 'checking') {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <CircularProgress size={60} sx={{ color: 'primary.main' }} />
          <Typography variant="h6" mt={2} color="text.secondary">
            Connecting to Spotify...
          </Typography>
        </motion.div>
      </Box>
    )
  }

  if (authStatus === 'error') {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        bgcolor="background.default"
        p={3}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button
            variant="contained"
            onClick={handleLogin}
            sx={{
              background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
              },
            }}
          >
            Try Again
          </Button>
        </motion.div>
      </Box>
    )
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="background.default"
      p={3}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography
          variant="h2"
          component="h1"
          gutterBottom
          sx={{
            background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold',
          }}
        >
          Moosic
        </Typography>
        <Typography variant="h5" color="text.secondary" align="center" mb={4}>
          Create personalized playlists with AI
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={handleLogin}
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
          Login with Spotify
        </Button>
      </motion.div>
    </Box>
  )
}

export default Auth