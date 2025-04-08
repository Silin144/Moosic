import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Auth() {
  const navigate = useNavigate()
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // Only open the login window if we're not already in the process
    if (!window.location.search.includes('?from=spotify')) {
      const loginWindow = window.open('/api/login', 'Spotify Login', 'width=800,height=600')
      if (!loginWindow) {
        setError('Popup was blocked. Please allow popups for this site.')
      }
    }

    // Listen for messages from the auth window
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from either the API server or the development server
      if (event.data === 'auth_success') {
        // Add a small delay to allow the auth check to complete
        setTimeout(() => navigate('/'), 1000)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [navigate])

  const handleLogin = () => {
    setError('')
    const loginWindow = window.open('/api/login', 'Spotify Login', 'width=800,height=600')
    if (!loginWindow) {
      setError('Popup was blocked. Please allow popups for this site.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-8">
      <div className="max-w-md mx-auto text-center space-y-6 p-8 bg-card rounded-lg border shadow-sm">
        <h1 className="text-2xl font-bold">Authenticating with Spotify</h1>
        
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              {window.location.search.includes('?from=spotify')
                ? 'Completing authentication...'
                : 'A new window has opened for Spotify authentication. Please complete the login process there.'}
            </p>
            <div className="animate-pulse flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}