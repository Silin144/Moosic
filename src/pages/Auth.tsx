import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const from = searchParams.get('from')

    if (error) {
      setError(error)
      setIsLoading(false)
      return
    }

    if (from === 'spotify') {
      // We've been redirected back from Spotify
      setIsLoading(false)
      navigate('/')
    }
  }, [searchParams, navigate])

  const handleLogin = () => {
    setIsLoading(true)
    setError(null)
    
    // First check if the API URL is available
    if (!import.meta.env.VITE_API_URL) {
      setError('API URL is not configured')
      setIsLoading(false)
      return
    }

    console.log('Making request to:', `${import.meta.env.VITE_API_URL}/api/login`)

    // Make the request to the login endpoint
    fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      mode: 'cors'
    })
    .then(async (response) => {
      console.log('Response status:', response.status)
      if (!response.ok) {
        const text = await response.text()
        console.error('Error response:', text)
        try {
          const errorData = JSON.parse(text)
          throw new Error(errorData.error || 'Failed to login')
        } catch (e) {
          throw new Error(`Failed to login: ${text}`)
        }
      }
      return response.json()
    })
    .then((data) => {
      console.log('Received data:', data)
      if (data.auth_url) {
        window.location.href = data.auth_url
      } else {
        throw new Error('No auth URL received')
      }
    })
    .catch((err) => {
      console.error('Login error:', err)
      setError(err.message || 'Failed to connect to the server')
      setIsLoading(false)
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={handleLogin}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-8">Welcome to Moosic</h1>
        <button
          onClick={handleLogin}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Login with Spotify
        </button>
      </div>
    </div>
  )
}