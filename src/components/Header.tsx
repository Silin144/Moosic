import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface User {
  id: string
  display_name: string
  images: { url: string }[]
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('http://127.0.0.1:3001/api/me')
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(console.error)
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:3001/api/logout', { method: 'POST' })
      navigate('/auth')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-b z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img src="/music-note.svg" alt="Logo" className="w-8 h-8" />
          <span className="text-xl font-semibold">MoodMusic</span>
        </div>
        
        {user && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {user.images?.[0]?.url && (
                <img 
                  src={user.images[0].url} 
                  alt={user.display_name}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm font-medium">{user.display_name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}