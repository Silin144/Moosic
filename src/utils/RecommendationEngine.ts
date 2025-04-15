import { Track, AudioFeatures } from '../types/spotify';

export class RecommendationEngine {
  private spotifyClient: any;
  private readonly MAX_SEEDS = 5;

  constructor(spotifyClient: any) {
    this.spotifyClient = spotifyClient;
  }

  private async getAudioFeatures(trackIds: string[]): Promise<AudioFeatures[]> {
    const features = await this.spotifyClient.getAudioFeaturesForTracks(trackIds);
    return features.body.audio_features;
  }

  private calculateAverageFeatures(features: AudioFeatures[]): Partial<AudioFeatures> {
    const sum = features.reduce((acc, curr) => ({
      danceability: acc.danceability + curr.danceability,
      energy: acc.energy + curr.energy,
      valence: acc.valence + curr.valence,
      tempo: acc.tempo + curr.tempo,
    }), {
      danceability: 0,
      energy: 0,
      valence: 0,
      tempo: 0,
    });

    return {
      danceability: sum.danceability / features.length,
      energy: sum.energy / features.length,
      valence: sum.valence / features.length,
      tempo: sum.tempo / features.length,
    };
  }

  public async getRecommendations(params: {
    seedTracks?: string[];
    seedArtists?: string[];
    seedGenres?: string[];
    mood?: string;
    genre?: string;
    era?: string;
    limit?: number;
  }): Promise<Track[]> {
    const {
      seedTracks = [],
      seedArtists = [],
      seedGenres = [],
      mood,
      genre,
      era,
      limit = 20,
    } = params;

    // Get audio features for seed tracks if provided
    let targetFeatures: Partial<AudioFeatures> | undefined;
    if (seedTracks.length > 0) {
      const features = await this.getAudioFeatures(seedTracks);
      targetFeatures = this.calculateAverageFeatures(features);
    }

    // Prepare recommendation parameters
    const recommendationParams: any = {
      limit,
      seed_tracks: seedTracks.slice(0, this.MAX_SEEDS),
      seed_artists: seedArtists.slice(0, this.MAX_SEEDS),
      seed_genres: seedGenres.slice(0, this.MAX_SEEDS),
    };

    // Add mood-based parameters
    if (mood) {
      switch (mood.toLowerCase()) {
        case 'happy':
          recommendationParams.target_valence = 0.8;
          recommendationParams.target_energy = 0.7;
          break;
        case 'sad':
          recommendationParams.target_valence = 0.2;
          recommendationParams.target_energy = 0.4;
          break;
        case 'energetic':
          recommendationParams.target_energy = 0.9;
          recommendationParams.target_danceability = 0.8;
          break;
        case 'relaxed':
          recommendationParams.target_energy = 0.3;
          recommendationParams.target_tempo = 90;
          break;
      }
    }

    // Add target features if available
    if (targetFeatures) {
      Object.assign(recommendationParams, {
        target_danceability: targetFeatures.danceability,
        target_energy: targetFeatures.energy,
        target_valence: targetFeatures.valence,
        target_tempo: targetFeatures.tempo,
      });
    }

    // Get recommendations from Spotify
    const response = await this.spotifyClient.getRecommendations(recommendationParams);
    return response.body.tracks;
  }
} 