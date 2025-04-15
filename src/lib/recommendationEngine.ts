import { Track, AudioFeatures } from '../types/spotify';

interface RecommendationContext {
  seedTracks: Track[];
  seedArtists: string[];
  seedGenres: string[];
  mood?: string;
  genre?: string;
  era?: string;
  limit: number;
}

export class RecommendationEngine {
  private spotifyApi: any;
  private readonly MAX_SEEDS = 5;

  constructor(spotifyApi: any) {
    this.spotifyApi = spotifyApi;
  }

  private async getAudioFeatures(trackIds: string[]): Promise<AudioFeatures[]> {
    const features = await this.spotifyApi.getAudioFeaturesForTracks(trackIds);
    return features.body.audio_features;
  }

  private calculateAverageFeatures(features: AudioFeatures[]): Partial<AudioFeatures> {
    const sum = features.reduce((acc, curr) => ({
      danceability: acc.danceability + curr.danceability,
      energy: acc.energy + curr.energy,
      valence: acc.valence + curr.valence,
      tempo: acc.tempo + curr.tempo,
      acousticness: acc.acousticness + curr.acousticness,
      instrumentalness: acc.instrumentalness + curr.instrumentalness,
      liveness: acc.liveness + curr.liveness,
      speechiness: acc.speechiness + curr.speechiness
    }), {
      danceability: 0,
      energy: 0,
      valence: 0,
      tempo: 0,
      acousticness: 0,
      instrumentalness: 0,
      liveness: 0,
      speechiness: 0
    });

    const count = features.length;
    return {
      danceability: sum.danceability / count,
      energy: sum.energy / count,
      valence: sum.valence / count,
      tempo: sum.tempo / count,
      acousticness: sum.acousticness / count,
      instrumentalness: sum.instrumentalness / count,
      liveness: sum.liveness / count,
      speechiness: sum.speechiness / count
    };
  }

  private getMoodParameters(mood: string): Partial<AudioFeatures> {
    switch (mood.toLowerCase()) {
      case 'happy':
        return { valence: 0.8, energy: 0.7, danceability: 0.7 };
      case 'sad':
        return { valence: 0.2, energy: 0.4, acousticness: 0.7 };
      case 'energetic':
        return { energy: 0.9, danceability: 0.8, tempo: 130 };
      case 'relaxed':
        return { energy: 0.3, acousticness: 0.8, tempo: 90 };
      case 'focused':
        return { instrumentalness: 0.8, speechiness: 0.1, energy: 0.6 };
      case 'party':
        return { danceability: 0.9, energy: 0.9, valence: 0.8 };
      default:
        return {};
    }
  }

  public async getRecommendations(context: RecommendationContext): Promise<Track[]> {
    const {
      seedTracks,
      seedArtists,
      seedGenres,
      mood,
      genre,
      era,
      limit
    } = context;

    // Get audio features for seed tracks if provided
    let targetFeatures: Partial<AudioFeatures> = {};
    if (seedTracks.length > 0) {
      const features = await this.getAudioFeatures(seedTracks.map(t => t.id));
      targetFeatures = this.calculateAverageFeatures(features);
    }

    // Add mood-based parameters
    if (mood) {
      const moodParams = this.getMoodParameters(mood);
      targetFeatures = { ...targetFeatures, ...moodParams };
    }

    // Prepare recommendation parameters
    const recommendationParams: any = {
      limit,
      seed_tracks: seedTracks.slice(0, this.MAX_SEEDS).map(t => t.id),
      seed_artists: seedArtists.slice(0, this.MAX_SEEDS),
      seed_genres: seedGenres.slice(0, this.MAX_SEEDS),
      target_audio_features: targetFeatures
    };

    // Add era-based filtering if specified
    if (era) {
      const currentYear = new Date().getFullYear();
      switch (era.toLowerCase()) {
        case 'classic':
          recommendationParams.max_year = 1980;
          break;
        case 'retro':
          recommendationParams.min_year = 1980;
          recommendationParams.max_year = 2000;
          break;
        case 'modern':
          recommendationParams.min_year = 2000;
          break;
      }
    }

    // Get recommendations from Spotify
    const response = await this.spotifyApi.getRecommendations(recommendationParams);
    return response.body.tracks;
  }
} 