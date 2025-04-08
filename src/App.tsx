import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Header from './components/Header'
import './index.css'

const queryClient = new QueryClient()

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/check-auth')
      const data = await res.json()
      setIsAuthenticated(data.authenticated)
    } catch (error) {
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  // Also check auth when returning from Spotify
  useEffect(() => {
    if (window.location.pathname === '/auth' && window.location.search.includes('from=spotify')) {
      checkAuth()
    }
  }, [window.location.search])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {isAuthenticated && <Header />}
      <main className="pt-16">
        {children}
      </main>
    </div>
  )

  const router = createBrowserRouter([
    {
      path: '/',
      element: isAuthenticated ? (
        <Layout>
          <Home />
        </Layout>
      ) : (
        <Navigate to="/auth" />
      ),
    },
    {
      path: '/auth',
      element: isAuthenticated ? (
        <Navigate to="/" />
      ) : (
        <Layout>
          <Auth />
        </Layout>
      ),
    },
  ])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
