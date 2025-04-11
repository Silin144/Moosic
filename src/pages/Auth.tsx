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
        console.log('Checking authentication status...')
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/check-auth`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        })
        
        if (!response.ok) {
          console.error('Auth check failed with status:', response.status)
          throw new Error('Failed to check authentication status')
        }
        
        const data = await response.json()
        console.log('Auth check response:', data)
        
        if (data.authenticated) {
          console.log('User is authenticated, redirecting to home')
          setIsAuthenticated(true)
          setAuthStatus('authenticated')
          window.location.href = '/'
        } else {
          console.log('User is not authenticated, reason:', data.reason)
          setAuthStatus('idle')
        }
      } catch (err) {
        console.error('Auth check error:', err)
        setAuthStatus('error')
        setError('Failed to check authentication status')
      }
    }

    // Only run auth check if we're not in the callback flow
    const params = new URLSearchParams(location.search)
    const isCallbackFlow = !!params.get('code')
    
    if (params.get('auth') === 'success') {
      console.log('Auth success detected, checking auth...')
      checkAuth()
    } else if (params.get('auth') === 'error') {
      setAuthStatus('error')
      setError(params.get('message') || 'Authentication failed')
    } else if (isCallbackFlow) {
      // If we have a code but no auth status, we're in the callback flow
      console.log('Code parameter found in URL, handling callback...')
      // Don't run checkAuth now, let the callback handler do its work
    } else if (authStatus !== 'checking') {
      // Only check auth if we're not already checking
      checkAuth()
    }
  }, [location, setIsAuthenticated])

  const handleLogin = async () => {
    try {
      // Clear any existing session data
      localStorage.removeItem('code_verifier')
      sessionStorage.removeItem('state')
      
      // Generate PKCE code verifier and challenge
      const codeVerifier = generateRandomString(128)
      const data = new TextEncoder().encode(codeVerifier)
      const hashed = await crypto.subtle.digest('SHA-256', data)
      const codeChallenge = base64encode(hashed)
      
      // Store code verifier in localStorage
      localStorage.setItem('code_verifier', codeVerifier)
      
      // Generate state parameter
      const state = generateRandomString(16)
      sessionStorage.setItem('state', state)
      
      // Build authorization URL
      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
        response_type: 'code',
        redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI || '',
        state: state,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        scope: 'playlist-modify-public playlist-modify-private user-read-private user-read-email'
      })
      
      window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
    } catch (err) {
      console.error('Login error:', err)
      setAuthStatus('error')
      setError('Failed to initialize login')
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const storedState = sessionStorage.getItem('state')
    
    if (code && state) {
      // Verify state
      if (!storedState || state !== storedState) {
        console.error('State parameter mismatch')
        setAuthStatus('error')
        setError('State parameter mismatch')
        return
      }
      
      // Clear state from session storage
      sessionStorage.removeItem('state')
      
      // Get the code verifier from localStorage
      const codeVerifier = localStorage.getItem('code_verifier')
      if (!codeVerifier) {
        console.error('No code verifier found')
        setAuthStatus('error')
        setError('No code verifier found')
        return
      }
      
      // Make the POST request to our backend
      const exchangeCode = async () => {
        try {
          setAuthStatus('checking');
          console.log('Exchanging code for tokens...');
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              code,
              state,
              code_verifier: codeVerifier
            }),
            credentials: 'include',
            mode: 'cors'
          });
          
          console.log('Response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            let errorMessage = 'Failed to exchange code for tokens';
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.message || errorMessage;
            } catch (e) {
              // If parsing fails, use the error text directly
              errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
          }
          
          const data = await response.json();
          console.log('Authentication successful, user data:', data.user);
          
          // Clear the code verifier
          localStorage.removeItem('code_verifier');
          
          // Success - update auth status
          setIsAuthenticated(true);
          setAuthStatus('authenticated');
          
          // Wait a moment to ensure cookies are set before redirecting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          console.log('Checking cookies before redirect...');
          const checkResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/check-auth`, {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            }
          });
          
          const checkData = await checkResponse.json();
          console.log('Final auth check before redirect:', checkData);
          
          // Navigate to home page with full page refresh
          window.location.href = '/';
        } catch (error) {
          console.error('Error during callback:', error);
          setAuthStatus('error');
          setError(error instanceof Error ? error.message : 'An error occurred during authentication');
        }
      };
      
      exchangeCode()
    }
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