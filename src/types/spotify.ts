export interface Track {
  id: string;
  name: string;
  artists: Artist[];
  album: Album;
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  uri: string;
}

export interface Artist {
  id: string;
  name: string;
  genres?: string[];
  popularity?: number;
}

export interface Album {
  id: string;
  name: string;
  images: Image[];
  release_date: string;
}

export interface Image {
  url: string;
  height: number;
  width: number;
}

export interface AudioFeatures {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  duration_ms: number;
  time_signature: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  tracks: {
    total: number;
    items: Track[];
  };
  images: Image[];
  owner: {
    id: string;
    display_name: string;
  };
} 