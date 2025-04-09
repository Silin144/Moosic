import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      switch (errorParam) {
        case 'no_code':
          setError('Authentication failed: No authorization code received')
          break
        case 'token_failed':
          setError('Authentication failed: Could not get access token')
          break
        case 'callback_failed':
          setError('Authentication failed: Callback error occurred')
          break
        default:
          setError('Authentication failed: Unknown error occurred')
      }
      setIsLoading(false)
      return
    }

    // Only open the login window if we're not already in the process
    if (!searchParams.has('from')) {
      const loginWindow = window.open('/api/login', 'Spotify Login', 'width=800,height=600')
      if (!loginWindow) {
        setError('Popup was blocked. Please allow popups for this site.')
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }

    // Listen for messages from the auth window
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'auth_success') {
        navigate('/', { replace: true })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [navigate, searchParams])

  const handleLogin = () => {
    setError('')
    setIsLoading(true)
    const loginWindow = window.open('/api/login', 'Spotify Login', 'width=800,height=600')
    if (!loginWindow) {
      setError('Popup was blocked. Please allow popups for this site.')
      setIsLoading(false)
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
        ) : isLoading ? (
          <>
            <p className="text-muted-foreground">
              {searchParams.has('from')
                ? 'Completing authentication...'
                : 'A new window has opened for Spotify authentication. Please complete the login process there.'}
            </p>
            <div className="animate-pulse flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Click the button below to start the authentication process.
            </p>
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Login with Spotify
            </button>
          </>
        )}
      </div>
    </div>
  )
}