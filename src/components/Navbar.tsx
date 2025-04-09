import React from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Avatar, 
  Box, 
  IconButton,
  Menu,
  MenuItem,
  Divider
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { styled } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { Logout, MusicNote, PlaylistPlay } from '@mui/icons-material'

const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 'bold',
  cursor: 'pointer',
  '&:hover': {
    opacity: 0.8,
  },
}))

const Navbar: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, setIsAuthenticated } = useAuth()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [user, setUser] = React.useState<any>(null)

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/me`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setUser(data)
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }

    if (isAuthenticated) {
      fetchUser()
    }
  }, [isAuthenticated])

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsAuthenticated(false)
    handleClose()
    navigate('/auth')
  }

  return (
    <AppBar 
      position="static" 
      sx={{ 
        background: 'rgba(18, 18, 18, 0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Toolbar>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <GradientText 
            variant="h5" 
            onClick={() => navigate('/')}
            sx={{ mr: 2, cursor: 'pointer' }}
          >
            Moosic
          </GradientText>
        </motion.div>

        <Box sx={{ flexGrow: 1 }} />

        {isAuthenticated ? (
          <>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                color="inherit"
                startIcon={<PlaylistPlay />}
                onClick={() => navigate('/generate')}
                sx={{
                  mr: 2,
                  borderRadius: 2,
                  '&:hover': {
                    background: 'rgba(29, 185, 84, 0.1)',
                  },
                }}
              >
                Generate Playlist
              </Button>
            </motion.div>

            <IconButton
              onClick={handleMenu}
              sx={{ p: 0 }}
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Avatar
                  src={user?.images?.[0]?.url}
                  alt={user?.display_name}
                  sx={{
                    width: 40,
                    height: 40,
                    border: '2px solid #1DB954',
                  }}
                />
              </motion.div>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  background: 'rgba(18, 18, 18, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 2,
                },
              }}
            >
              <MenuItem 
                onClick={() => {
                  handleClose()
                  navigate('/profile')
                }}
                sx={{
                  '&:hover': {
                    background: 'rgba(29, 185, 84, 0.1)',
                  },
                }}
              >
                <Avatar 
                  src={user?.images?.[0]?.url} 
                  sx={{ width: 32, height: 32, mr: 2 }}
                />
                <Box>
                  <Typography variant="body1">
                    {user?.display_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user?.email}
                  </Typography>
                </Box>
              </MenuItem>
              <Divider sx={{ my: 1, opacity: 0.1 }} />
              <MenuItem 
                onClick={handleLogout}
                sx={{
                  color: 'error.main',
                  '&:hover': {
                    background: 'rgba(211, 47, 47, 0.1)',
                  },
                }}
              >
                <Logout sx={{ mr: 2 }} />
                Logout
              </MenuItem>
            </Menu>
          </>
        ) : (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              color="inherit"
              onClick={() => navigate('/auth')}
              sx={{
                borderRadius: 2,
                '&:hover': {
                  background: 'rgba(29, 185, 84, 0.1)',
                },
              }}
            >
              Login
            </Button>
          </motion.div>
        )}
      </Toolbar>
    </AppBar>
  )
}

export default Navbar 