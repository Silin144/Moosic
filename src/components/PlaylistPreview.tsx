interface Track {
  name: string;
  artist: string;
  image?: string;
}

interface PlaylistPreviewProps {
  tracks: Track[];
  description: string;
}

export default function PlaylistPreview({ tracks, description }: PlaylistPreviewProps) {
  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border shadow-lg p-6 space-y-4">
      <h3 className="text-xl font-semibold flex items-center space-x-2">
        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <span>Playlist Preview</span>
      </h3>

      <p className="text-muted-foreground">{description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tracks.map((track, index) => (
          <div 
            key={index}
            className="flex items-center space-x-3 p-3 bg-background/50 rounded-lg"
          >
            {track.image && (
              <img 
                src={track.image} 
                alt={track.name}
                className="w-12 h-12 rounded-md object-cover"
              />
            )}
            <div>
              <p className="font-medium line-clamp-1">{track.name}</p>
              <p className="text-sm text-muted-foreground line-clamp-1">{track.artist}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}