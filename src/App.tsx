import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import GeneratePlaylist from './pages/GeneratePlaylist'
import Auth from './pages/Auth'
import { useState, useEffect } from 'react'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1DB954', // Spotify green
    },
    secondary: {
      main: '#191414', // Spotify black
    },
    background: {
      default: '#121212',
      paper: '#181818',
    },
  },
  typography: {
    fontFamily: '"Circular", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
})

const queryClient = new QueryClient()

const AppContent = () => {
  const { isAuthenticated } = useAuth()
  const [initialized, setInitialized] = useState(false)

  // Wait for auth state to stabilize before rendering routes
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialized(true)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [])

  // Don't render routes until we've initialized
  if (!initialized) {
    return null
  }

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <GeneratePlaylist />
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
