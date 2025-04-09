import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

const Auth: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setError(error === 'access_denied' ? 'Login was cancelled' : error)
      setLoading(false)
      return
    }

    if (code === 'success') {
      login()
      navigate('/')
    }
  }, [searchParams, login, navigate])

  const handleLogin = () => {
    setLoading(true)
    setError(null)
    window.location.replace(`${process.env.REACT_APP_API_URL}/api/login`)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome to Moosic
      </Typography>
      {error && (
        <Typography color="error" variant="body1" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      <Button
        variant="contained"
        color="primary"
        onClick={handleLogin}
        disabled={loading}
        size="large"
        sx={{ mt: 2 }}
      >
        Login with Spotify
      </Button>
    </Box>
  )
}

export default Auth