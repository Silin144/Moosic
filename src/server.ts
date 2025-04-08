import express from 'express';
import type { Request, Response } from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CreatePlaylistRequest {
  mood: string;
  genres: string[];
  playlistName: string;
}

interface SongResponse {
  songs: Array<{
    name: string;
    artist: string;
  }>;
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, '../dist')));

async function generateSongRecommendations(mood: string, genres: string[]) {
  const prompt = `Generate a playlist of 5 songs that match the mood "${mood}" and genres ${genres.join(', ')}. 
    For each song, provide the song name and artist name. Make sure these are real songs and artists.
    Format the response as a JSON object with a "songs" array containing objects with "name" and "artist" properties.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a music expert who provides song recommendations. Always respond with valid JSON only."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error('No content received from OpenAI');
  }

  const response = JSON.parse(content) as SongResponse;
  return response.songs;
}

app.post('/api/create-playlist', async (req: Request<{}, {}, CreatePlaylistRequest>, res: Response) => {
  try {
    const { mood, genres, playlistName } = req.body;

    // Generate song recommendations using OpenAI
    const suggestedTracks = await generateSongRecommendations(mood, genres);

    // Generate a description based on the mood and genres
    const description = `A ${mood.toLowerCase()} playlist featuring ${genres.join(', ')} music.`;

    // Create the response object matching the frontend's expected structure
    const response = {
      preview: {
        suggestedTracks,
        description
      },
      aiEnhancements: {
        adjustedMood: mood,
        suggestedGenres: genres,
        audioFeatures: {
          energy: Math.random() * 0.5 + 0.5, // Random value between 0.5 and 1 for demo
          valence: Math.random() * 0.5 + 0.5,
          danceability: Math.random() * 0.5 + 0.5
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});