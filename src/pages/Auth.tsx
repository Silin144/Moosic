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
    window.location.href = '/api/login'
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