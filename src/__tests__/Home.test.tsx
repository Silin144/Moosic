import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '../pages/Home'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
)

describe('Home Component', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    queryClient.clear()
  })

  it('renders the main title', () => {
    render(<Home />, { wrapper })
    expect(screen.getByText('AI-Enhanced Mood Music')).toBeInTheDocument()
  })

  it('shows validation errors when submitting empty form', async () => {
    render(<Home />, { wrapper })
    
    const submitButton = screen.getByTestId('submit-button')
    fireEvent.click(submitButton)

    await waitFor(() => {
      const moodError = screen.getByTestId('mood-error')
      const genreError = screen.getByTestId('genres-error')
      const nameError = screen.getByTestId('playlist-name-error')

      expect(moodError).toBeInTheDocument()
      expect(genreError).toBeInTheDocument()
      expect(nameError).toBeInTheDocument()
    })
  })

  it('successfully submits form with valid data', async () => {
    const mockResponse = {
      status: 'success',
      playlistUrl: 'https://open.spotify.com/playlist/123',
      aiEnhancements: {
        adjustedMood: 'Energetic',
        suggestedGenres: ['Rock', 'Electronic'],
        audioFeatures: {
          valence: 0.8,
          energy: 0.9,
          danceability: 0.7
        }
      }
    }

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })
    )

    render(<Home />, { wrapper })

    // Fill in form
    const happyRadio = screen.getByTestId('mood-happy')
    fireEvent.click(happyRadio)

    const rockCheckbox = screen.getByTestId('genre-rock')
    fireEvent.click(rockCheckbox)

    const playlistNameInput = screen.getByTestId('playlist-name-input')
    fireEvent.change(playlistNameInput, {
      target: { value: 'My Test Playlist' }
    })

    // Submit form
    const submitButton = screen.getByTestId('submit-button')
    fireEvent.click(submitButton)

    // Wait for success message
    await waitFor(() => {
      const successMessage = screen.getByTestId('success-message')
      expect(successMessage).toBeInTheDocument()
      expect(successMessage).toHaveTextContent('Playlist created successfully!')
    })

    // Verify API call
    expect(mockFetch).toHaveBeenCalledWith('/api/create-playlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mood: 'Happy',
        genres: ['Rock'],
        playlistName: 'My Test Playlist'
      })
    })
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'API Error', details: 'Failed to create playlist' })
      })
    )

    render(<Home />, { wrapper })

    // Fill in form
    const happyRadio = screen.getByTestId('mood-happy')
    fireEvent.click(happyRadio)

    const rockCheckbox = screen.getByTestId('genre-rock')
    fireEvent.click(rockCheckbox)

    const playlistNameInput = screen.getByTestId('playlist-name-input')
    fireEvent.change(playlistNameInput, {
      target: { value: 'My Test Playlist' }
    })

    // Submit form
    const submitButton = screen.getByTestId('submit-button')
    fireEvent.click(submitButton)

    // Wait for error message
    await waitFor(() => {
      const errorMessage = screen.getByTestId('error-message')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveTextContent('Failed to create playlist')
    })
  })
})