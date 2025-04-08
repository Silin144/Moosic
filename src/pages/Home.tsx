import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import MoodIcon from '../components/MoodIcon'
import PlaylistPreview from '../components/PlaylistPreview'

const formSchema = z.object({
  mood: z.string().min(1, 'Please select a mood'),
  genres: z.array(z.string()).min(1, 'Please select at least one genre'),
  playlistName: z.string().min(1, 'Please enter a playlist name'),
})

type FormData = z.infer<typeof formSchema>

const moods = ['Happy', 'Sad', 'Energetic', 'Relaxed', 'Focused']
const genres = [
  'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical', 'Electronic',
  'Country', 'Latin', 'Metal', 'Folk', 'Blues', 'Reggae', 'Indie'
]

export default function Home() {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<any>(null)
  const [playlistPreview, setPlaylistPreview] = useState<{
    suggestedTracks: { name: string; artist: string; image?: string }[];
    description: string;
  } | null>(null)
  
  const { register, handleSubmit, formState: { errors }, control } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const selectedMood = useWatch({
    control,
    name: 'mood',
    defaultValue: '',
  })

  const createPlaylist = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('http://127.0.0.1:3001/api/create-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to create playlist')
      }
      return response.json()
    },
    onSuccess: (data) => {
      if (data.aiEnhancements) {
        setAiSuggestions(data.aiEnhancements)
      }
      if (data.preview) {
        setPlaylistPreview(data.preview)
      }
    },
  })

  const onSubmit = (data: FormData) => {
    createPlaylist.mutate(data)
  }

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">AI-Enhanced Mood Music</h1>
          <p className="text-lg text-muted-foreground">
            Create the perfect playlist based on your mood and music preferences, enhanced by AI
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Mood Selection */}
          <div className="space-y-4">
            <label className="text-xl font-semibold">How are you feeling?</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {moods.map((mood) => (
                <label
                  key={mood}
                  className={`
                    flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer
                    hover:bg-secondary/50 transition-all duration-200
                    ${selectedMood === mood ? 'border-primary bg-primary/10 scale-105' : 'border-border'}
                    ${errors.mood ? 'border-destructive' : ''}
                  `}
                >
                  <input
                    type="radio"
                    value={mood}
                    {...register('mood')}
                    className="sr-only"
                    data-testid={`mood-${mood.toLowerCase()}`}
                  />
                  <MoodIcon mood={mood} selected={selectedMood === mood} />
                  <span className={`text-sm font-medium ${selectedMood === mood ? 'text-primary' : ''}`}>
                    {mood}
                  </span>
                </label>
              ))}
            </div>
            {errors.mood && (
              <p className="text-destructive text-sm" data-testid="mood-error">{errors.mood.message}</p>
            )}
          </div>

          {/* Genre Selection */}
          <div className="space-y-4">
            <label className="text-xl font-semibold">Select your preferred genres</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {genres.map((genre) => (
                <label
                  key={genre}
                  className={`
                    relative flex items-center justify-center p-3 border rounded-lg cursor-pointer
                    hover:bg-secondary/50 transition-all duration-200
                    ${selectedGenres.includes(genre) ? 'border-primary bg-primary/10 scale-105' : 'border-border'}
                    ${errors.genres ? 'border-destructive' : ''}
                  `}
                >
                  <input
                    type="checkbox"
                    value={genre}
                    {...register('genres')}
                    onChange={() => toggleGenre(genre)}
                    className="sr-only"
                    data-testid={`genre-${genre.toLowerCase().replace(' ', '-')}`}
                  />
                  {selectedGenres.includes(genre) && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                  )}
                  <span className={`text-sm font-medium ${selectedGenres.includes(genre) ? 'text-primary' : ''}`}>
                    {genre}
                  </span>
                </label>
              ))}
            </div>
            {errors.genres && (
              <p className="text-destructive text-sm" data-testid="genres-error">{errors.genres.message}</p>
            )}
          </div>

          {/* Playlist Name */}
          <div className="space-y-4">
            <label className="text-xl font-semibold">Name your playlist</label>
            <div className="relative">
              <input
                type="text"
                {...register('playlistName')}
                className={`
                  w-full p-4 border rounded-lg bg-background/50 backdrop-blur-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200
                  ${errors.playlistName ? 'border-destructive' : 'border-border hover:border-primary/50'}
                `}
                placeholder="Enter a name for your playlist"
                data-testid="playlist-name-input"
              />
              {errors.playlistName && (
                <p className="absolute -bottom-6 left-0 text-destructive text-sm" data-testid="playlist-name-error">
                  {errors.playlistName.message}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={createPlaylist.isPending}
            className={`
              w-full py-4 px-8 rounded-lg bg-primary text-primary-foreground font-semibold
              hover:bg-primary/90 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-primary/50
              ${createPlaylist.isPending ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
            data-testid="submit-button"
          >
            {createPlaylist.isPending ? (
              <span className="flex items-center justify-center space-x-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating your AI-enhanced playlist...</span>
              </span>
            ) : (
              'Create Your Playlist'
            )}
          </button>
        </form>

        {/* Results Section */}
        <div className="space-y-6">
          {/* Error Message */}
          {createPlaylist.isError && (
            <div
              className="p-6 bg-destructive/5 border border-destructive/20 rounded-xl shadow-lg animate-fadeIn"
              data-testid="error-message"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-destructive font-medium">{createPlaylist.error.message}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {createPlaylist.isSuccess && (
            <div
              className="p-6 bg-primary/5 border border-primary/20 rounded-xl shadow-lg animate-fadeIn"
              data-testid="success-message"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold">Playlist Created!</h3>
              </div>
              {createPlaylist.data?.playlistUrl && (
                <a
                  href={createPlaylist.data.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors"
                  data-testid="spotify-link"
                >
                  <span>Open in Spotify</span>
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* Playlist Preview */}
          {playlistPreview && (
            <PlaylistPreview
              tracks={playlistPreview.suggestedTracks}
              description={playlistPreview.description}
            />
          )}

          {/* AI Suggestions Display */}
          {aiSuggestions && (
            <div
              className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border shadow-lg space-y-4 animate-fadeIn"
              data-testid="ai-suggestions"
            >
              <h3 className="text-xl font-semibold flex items-center space-x-2">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>AI-Enhanced Playlist Insights</span>
              </h3>
              <div className="space-y-3">
                <p><span className="font-medium">Mood Analysis:</span> {aiSuggestions.adjustedMood}</p>
                <p><span className="font-medium">Additional Genres:</span> {aiSuggestions.suggestedGenres.join(', ')}</p>
                <div>
                  <p className="font-medium mb-2">Audio Features:</p>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(aiSuggestions.audioFeatures).map(([key, value]) => (
                      <div key={key} className="bg-background/50 p-3 rounded-lg text-center">
                        <div className="text-lg font-semibold">{Math.round(Number(value) * 100)}%</div>
                        <div className="text-xs text-muted-foreground capitalize">{key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {createPlaylist.isSuccess && (
            <div
              className="p-6 bg-primary/5 border border-primary/20 rounded-xl shadow-lg animate-fadeIn"
              data-testid="success-message"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold">Playlist Created!</h3>
              </div>
              {createPlaylist.data?.playlistUrl && (
                <a
                  href={createPlaylist.data.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors"
                  data-testid="spotify-link"
                >
                  <span>Open in Spotify</span>
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* Error Message */}
          {createPlaylist.isError && (
            <div
              className="p-6 bg-destructive/5 border border-destructive/20 rounded-xl shadow-lg animate-fadeIn"
              data-testid="error-message"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-destructive font-medium">{createPlaylist.error.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}