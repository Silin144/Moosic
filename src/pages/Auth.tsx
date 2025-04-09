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

    console.log('Auth component mounted with params:', { code, error })

    if (error) {
      console.error('Auth error:', error)
      setError(error === 'access_denied' ? 'Login was cancelled' : error)
      setLoading(false)
      return
    }

    if (code === 'success') {
      console.log('Auth success, logging in...')
      login()
      // Use a small delay to ensure state updates before navigation
      setTimeout(() => {
        console.log('Navigating to home...')
        navigate('/', { replace: true })
      }, 100)
    }
  }, [searchParams, navigate, login])

  const handleLogin = () => {
    console.log('Initiating login...')
    setLoading(true)
    setError(null)
    const loginUrl = `${import.meta.env.VITE_API_URL}/api/login`
    console.log('Login URL:', loginUrl)
    window.location.href = loginUrl
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome to Moosic
      </Typography>
      {loading ? (
        <CircularProgress />
      ) : error ? (
        <>
          <Typography color="error" variant="body1" sx={{ mb: 2 }}>
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
        </>
      ) : (
        <Button
          variant="contained"
          color="primary"
          onClick={handleLogin}
          size="large"
          sx={{ mt: 2 }}
        >
          Login with Spotify
        </Button>
      )}
    </Box>
  )
}

export default Auth