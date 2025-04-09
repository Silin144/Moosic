import React from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent,
  useTheme
} from '@mui/material'
import { motion } from 'framer-motion'
import { styled } from '@mui/material/styles'
import { 
  MusicNote, 
  PlaylistPlay, 
  AutoAwesome, 
  Psychology 
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'

const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 'bold',
}))

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 16,
  transition: 'transform 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 12px 24px rgba(29, 185, 84, 0.2)',
  },
}))

const Home: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const theme = useTheme()

  const features = [
    {
      icon: <AutoAwesome sx={{ fontSize: 40, color: '#1DB954' }} />,
      title: 'AI-Powered',
      description: 'Our advanced AI analyzes your preferences to create the perfect playlist for any mood or occasion.'
    },
    {
      icon: <MusicNote sx={{ fontSize: 40, color: '#1DB954' }} />,
      title: 'Smart Recommendations',
      description: 'Get personalized song suggestions based on your listening history and preferences.'
    },
    {
      icon: <Psychology sx={{ fontSize: 40, color: '#1DB954' }} />,
      title: 'Intelligent Mixing',
      description: 'Experience seamless transitions and perfect song order for an enhanced listening experience.'
    }
  ]

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #121212 0%, #1DB954 100%)',
        pt: 8,
        pb: 12,
      }}
    >
      <Container maxWidth="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Box textAlign="center" mb={8}>
            <GradientText variant="h2" gutterBottom>
              Create Your Perfect Playlist
            </GradientText>
            <Typography 
              variant="h5" 
              color="text.secondary" 
              sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
            >
              Let AI craft the perfect playlist for your mood, activity, or occasion
            </Typography>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<PlaylistPlay />}
                onClick={() => navigate(isAuthenticated ? '/generate' : '/auth')}
                sx={{
                  background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
                  },
                  py: 2,
                  px: 4,
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  borderRadius: 2,
                  textTransform: 'none',
                  boxShadow: '0 4px 14px 0 rgba(29, 185, 84, 0.39)'
                }}
              >
                {isAuthenticated ? 'Generate Playlist' : 'Get Started'}
              </Button>
            </motion.div>
          </Box>
        </motion.div>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 4 }}>
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
            >
              <FeatureCard>
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Box mb={2}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h5" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </FeatureCard>
            </motion.div>
          ))}
        </Box>

        <Box 
          mt={12} 
          p={4} 
          sx={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Typography variant="h4" align="center" gutterBottom>
              Ready to Experience the Future of Playlists?
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
              Join thousands of music lovers who are creating perfect playlists with AI
            </Typography>
            <Box textAlign="center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate(isAuthenticated ? '/generate' : '/auth')}
                  sx={{
                    background: 'linear-gradient(45deg, #1DB954 30%, #1ED760 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #1ED760 30%, #1DB954 90%)',
                    },
                    py: 2,
                    px: 4,
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    borderRadius: 2,
                    textTransform: 'none',
                    boxShadow: '0 4px 14px 0 rgba(29, 185, 84, 0.39)'
                  }}
                >
                  {isAuthenticated ? 'Create Your Playlist' : 'Start Now'}
                </Button>
              </motion.div>
            </Box>
          </motion.div>
        </Box>
      </Container>
    </Box>
  )
}

export default Home