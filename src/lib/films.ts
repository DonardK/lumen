import type { LibraryEntry } from '@/types'

export type FilmTag = 'animation' | 'live-action' | 'short'

export type Film = {
  id: string
  title: string
  year: number
  director: string
  genre: string
  tags: FilmTag[]
  durationSeconds: number
  synopsis: string
  poster: string
  magnetURI: string
  progressSeconds: number
  fileIndex: number
  lastWatchedAt: string
}

export function toFilm(infoHash: string, entry: LibraryEntry): Film {
  const tags = (entry.tags?.length ? entry.tags : ['live-action']) as FilmTag[]
  return {
    id: infoHash,
    title: entry.title || 'Untitled',
    year: entry.year || 0,
    director: entry.director || '',
    genre: entry.genre || '',
    tags,
    durationSeconds: entry.durationSeconds || 0,
    synopsis: entry.overview || '',
    poster: entry.posterUrl || '',
    magnetURI: entry.magnetURI,
    progressSeconds: entry.progressSeconds || 0,
    fileIndex: entry.fileIndex || 0,
    lastWatchedAt: entry.lastWatchedAt || entry.addedAt || '',
  }
}
