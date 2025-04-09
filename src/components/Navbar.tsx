import React, { useState, useEffect } from 'react'
import { AppBar, Toolbar, Typography, Button, Avatar, Box, IconButton, Menu, MenuItem } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Logout as LogoutIcon, AccountCircle } from '@mui/icons-material'

const Navbar: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, setIsAuthenticated } = useAuth()
  const [userInfo, setUserInfo] = useState<any>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetch(`${import.meta.env.VITE_API_URL}/api/me`, {
        credentials: 'include'
      })
        .then(response => response.json())
        .then(data => setUserInfo(data))
        .catch(error => console.error('Error fetching user info:', error))
    }
  }, [isAuthenticated])

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('spotify_token')
    handleClose()
    navigate('/auth')
  }

  return (
    <AppBar position="static" elevation={0} sx={{ backgroundColor: 'transparent' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Typography
          variant="h6"
          component="div"
          sx={{
            cursor: 'pointer',
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
          onClick={() => navigate('/')}
        >
          Moosic
        </Typography>

        {isAuthenticated && userInfo ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              size="large"
              onClick={handleMenu}
              sx={{ color: 'text.primary' }}
            >
              {userInfo.images?.[0]?.url ? (
                <Avatar
                  src={userInfo.images[0].url}
                  alt={userInfo.display_name}
                  sx={{ width: 40, height: 40 }}
                />
              ) : (
                <AccountCircle sx={{ width: 40, height: 40 }} />
              )}
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                  mt: 1.5,
                  '& .MuiAvatar-root': {
                    width: 32,
                    height: 32,
                    ml: -0.5,
                    mr: 1,
                  },
                },
              }}
            >
              <MenuItem onClick={handleClose}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  {userInfo.display_name}
                </Typography>
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <LogoutIcon sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <Button
            variant="contained"
            onClick={() => navigate('/auth')}
            sx={{
              background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
              },
            }}
          >
            Login
          </Button>
        )}
      </Toolbar>
    </AppBar>
  )
}

export default Navbar 