import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

const Auth: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, setIsAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
      return
    }

    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const from = searchParams.get('from')

    console.log('Auth component mounted with params:', { code, error, from })

    if (error) {
      console.error('Auth error:', error)
      setError(error)
      setLoading(false)
      return
    }

    if (code && from === 'spotify') {
      console.log('Auth success, logging in...')
      fetch(`${import.meta.env.VITE_API_URL}/api/callback?code=${code}`, {
        credentials: 'include',
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.access_token) {
            localStorage.setItem('spotify_token', data.access_token)
            setIsAuthenticated(true)
            navigate('/', { replace: true })
          } else {
            console.error('Failed to get access token')
            setError('Failed to get access token')
          }
        })
        .catch((err) => {
          console.error(err.message)
          setError(err.message)
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [searchParams, navigate, setIsAuthenticated, isAuthenticated])

  const handleLogin = () => {
    console.log('Initiating login...')
    setLoading(true)
    setError(null)
    const loginUrl = `${import.meta.env.VITE_API_URL}/api/login`
    console.log('Login URL:', loginUrl)
    window.location.href = loginUrl
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
          color="primary"
          onClick={handleLogin}
          size="large"
          sx={{ mt: 2 }}
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
      <Typography variant="h4" gutterBottom>
        Welcome to Moosic
      </Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={handleLogin}
        size="large"
        sx={{ mt: 2 }}
      >
        Login with Spotify
      </Button>
    </Box>
  )
}

export default Auth