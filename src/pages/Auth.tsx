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
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const from = searchParams.get('from')

    if (error) {
      setError(error)
      return
    }

    if (from === 'spotify') {
      setIsAuthenticated(true)
      navigate('/', { replace: true })
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
        <Button variant="contained" onClick={handleLogin}>
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
        onClick={handleLogin}
        disabled={loading}
      >
        Login with Spotify
      </Button>
    </Box>
  )
}

export default Auth