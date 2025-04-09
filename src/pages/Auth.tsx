import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

const Auth: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, setIsAuthenticated } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/check-auth`, {
          credentials: 'include'
        })
        const data = await response.json()
        if (data.authenticated) {
          setIsAuthenticated(true)
          navigate('/', { replace: true })
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      }
    }

    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const from = searchParams.get('from')

    if (error) {
      setError(error)
      return
    }

    if (from === 'spotify') {
      checkAuth()
    }
  }, [searchParams, navigate, setIsAuthenticated])

  const handleLogin = () => {
    setLoading(true)
    setError(null)
    window.location.href = `${import.meta.env.VITE_API_URL}/api/login`
  }

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={2}
      >
        <Typography color="error" variant="h6">
          {error}
        </Typography>
        <Button 
          variant="contained" 
          onClick={handleLogin}
          sx={{
            background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
            }
          }}
        >
          Try Again
        </Button>
      </Box>
    )
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      gap={2}
    >
      <Typography 
        variant="h4" 
        gutterBottom
        sx={{
          background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}
      >
        Welcome to Moosic
      </Typography>
      <Button
        variant="contained"
        onClick={handleLogin}
        disabled={loading}
        sx={{
          background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
          },
          py: 1.5,
          px: 4,
          fontSize: '1.1rem',
          fontWeight: 'bold'
        }}
      >
        Login with Spotify
      </Button>
    </Box>
  )
}

export default Auth