import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Box, Button, Typography, CircularProgress, Alert, Paper } from '@mui/material'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

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
        sx={{
          backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(50, 50, 50, 0.4) 0%, rgba(30, 30, 30, 0.8) 90%)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center' }}
        >
          <CircularProgress size={60} sx={{ color: 'primary.main' }} />
          <Typography variant="h6" mt={2} color="text.secondary">
            Connecting to Spotify...
          </Typography>
          <Box mt={4} sx={{ width: '40px', height: '40px', mx: 'auto', opacity: 0.7 }}>
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.5,
                ease: "easeInOut"
              }}
            >
              <MusicNoteIcon sx={{ fontSize: 40, color: 'primary.light' }} />
            </motion.div>
          </Box>
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
        sx={{
          backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(50, 50, 50, 0.4) 0%, rgba(30, 30, 30, 0.8) 90%)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ maxWidth: '450px', width: '100%' }}
        >
          <Paper
            elevation={4}
            sx={{
              p: 4,
              borderRadius: 3,
              textAlign: 'center',
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}
          >
            <ErrorOutlineIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight="500">
              Authentication Error
            </Typography>
            <Alert severity="error" sx={{ mb: 3, mt: 1 }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              onClick={handleLogin}
              fullWidth
              size="large"
              sx={{
                py: 1.2,
                mt: 2,
                fontWeight: 600
              }}
            >
              Try Again
            </Button>
          </Paper>
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
      sx={{
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(29, 185, 84, 0.15) 0%, rgba(30, 30, 30, 0.9) 90%)',
          zIndex: 0
        }
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          right: '10%',
          width: '250px',
          height: '250px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29, 185, 84, 0.1) 0%, rgba(29, 185, 84, 0) 70%)',
          filter: 'blur(40px)',
          zIndex: 0
        }}
      />
      
      <Box
        sx={{
          position: 'absolute',
          bottom: '5%',
          left: '15%',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29, 185, 84, 0.07) 0%, rgba(29, 185, 84, 0) 70%)',
          filter: 'blur(60px)',
          zIndex: 0
        }}
      />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '550px' }}
      >
        <Paper
          elevation={4}
          sx={{
            p: 5,
            borderRadius: 4,
            textAlign: 'center',
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '80px',
                height: '80px',
                background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
                borderRadius: '50%',
                mx: 'auto',
                mb: 3,
                boxShadow: '0 4px 20px rgba(29, 185, 84, 0.3)'
              }}
            >
              <MusicNoteIcon sx={{ fontSize: 40, color: '#fff' }} />
            </Box>
          </motion.div>
          
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 'bold',
              fontSize: { xs: '2.5rem', md: '3rem' },
              mb: 2
            }}
          >
            Moosic
          </Typography>
          
          <Typography 
            variant="h5" 
            color="text.secondary" 
            align="center" 
            mb={5}
            sx={{
              fontWeight: 400,
              maxWidth: '80%',
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Create personalized playlists with AI
          </Typography>
          
          <Button
            variant="contained"
            size="large"
            onClick={handleLogin}
            startIcon={<MusicNoteIcon />}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1.1rem',
              borderRadius: 30,
              boxShadow: '0 10px 20px rgba(29, 185, 84, 0.2)',
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Login with Spotify
          </Button>
          
          <Typography variant="caption" display="block" mt={4} color="text.secondary">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Typography>
        </Paper>
        
        <Box mt={4} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Powered by Spotify API and OpenAI
          </Typography>
        </Box>
      </motion.div>
    </Box>
  )
}

export default Auth