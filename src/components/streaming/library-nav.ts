import { Bookmark, Clapperboard, Clock, Film, House } from 'lucide-react'
import type { Film as FilmType } from '@/lib/films'

export type LibraryFilter =
  | 'all'
  | 'animation'
  | 'live-action'
  | 'short'
  | 'watchlist'

export const libraryNav = [
  { id: 'all', label: 'Home', icon: House },
  { id: 'animation', label: 'Animation', icon: Clapperboard },
  { id: 'live-action', label: 'Live action', icon: Film },
  { id: 'short', label: 'Shorts', icon: Clock },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
] as const satisfies ReadonlyArray<{
  id: LibraryFilter
  label: string
  icon: typeof House
}>

export function matchesFilter(
  film: FilmType,
  filter: LibraryFilter,
  watchlist: Set<string>,
) {
  if (filter === 'all') return true
  if (filter === 'watchlist') return watchlist.has(film.id)
  return film.tags.includes(filter)
}
