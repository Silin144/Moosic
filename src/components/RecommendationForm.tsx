import React, { useState } from 'react';
import { Track } from '../types/spotify';
import { RecommendationEngine } from '../lib/recommendationEngine';

interface RecommendationFormProps {
  spotifyApi: any;
  onRecommendationsGenerated: (tracks: Track[]) => void;
}

export const RecommendationForm: React.FC<RecommendationFormProps> = ({
  spotifyApi,
  onRecommendationsGenerated
}) => {
  const [seedTracks, setSeedTracks] = useState<Track[]>([]);
  const [seedArtists, setSeedArtists] = useState<string[]>([]);
  const [seedGenres, setSeedGenres] = useState<string[]>([]);
  const [mood, setMood] = useState<string>('');
  const [genre, setGenre] = useState<string>('');
  const [era, setEra] = useState<string>('');
  const [limit, setLimit] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const recommendationEngine = new RecommendationEngine(spotifyApi);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const context = {
        seedTracks,
        seedArtists,
        seedGenres,
        mood,
        genre,
        era,
        limit
      };

      const recommendations = await recommendationEngine.getRecommendations(context);
      onRecommendationsGenerated(recommendations);
    } catch (err) {
      setError('Failed to generate recommendations. Please try again.');
      console.error('Error generating recommendations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Seed Tracks
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Enter track names or IDs"
            onChange={(e) => {
              // TODO: Implement track search and selection
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Seed Artists
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Enter artist names or IDs"
            onChange={(e) => {
              // TODO: Implement artist search and selection
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Mood
          </label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          >
            <option value="">Select a mood</option>
            <option value="happy">Happy</option>
            <option value="sad">Sad</option>
            <option value="energetic">Energetic</option>
            <option value="calm">Calm</option>
            <option value="party">Party</option>
            <option value="focus">Focus</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Genre
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Enter genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Tracks
          </label>
          <input
            type="number"
            min="1"
            max="100"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
          />
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? 'Generating...' : 'Generate Recommendations'}
        </button>
      </div>
    </form>
  );
}; 