import type { Film } from '@/lib/films'
import { cn } from '@/lib/utils'
import { type LibraryFilter, libraryNav } from './library-nav'
import { MediaCard } from './media-card'

type MediaGridProps = {
  films: Film[]
  currentId: string
  filter: LibraryFilter
  onFilterChange: (filter: LibraryFilter) => void
  watchlist: Set<string>
  onSelect: (id: string) => void
  onToggleWatchlist: (id: string) => void
}

const FILTER_LABELS: Record<LibraryFilter, string> = {
  all: 'All',
  animation: 'Animation',
  'live-action': 'Live action',
  short: 'Shorts',
  watchlist: 'Watchlist',
}

export function MediaGrid({
  films,
  currentId,
  filter,
  onFilterChange,
  watchlist,
  onSelect,
  onToggleWatchlist,
}: MediaGridProps) {
  return (
    <section aria-labelledby="library-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="library-heading" className="text-xl font-semibold tracking-tight">
            Your library
          </h2>
          <p className="text-sm text-muted-foreground">
            {films.length} {films.length === 1 ? 'title' : 'titles'}
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter library"
          className="glass-subtle flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1"
        >
          {libraryNav.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => onFilterChange(item.id)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors',
                filter === item.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {FILTER_LABELS[item.id]}
            </button>
          ))}
        </div>
      </div>

      {films.length > 0 ? (
        <ul className="grid grid-cols-1 gap-x-4 gap-y-6 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {films.map((film, index) => (
            <li
              key={film.id}
              className="duration-500 animate-in fade-in fill-mode-both slide-in-from-bottom-3 motion-reduce:animate-none"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <MediaCard
                film={film}
                isCurrent={film.id === currentId}
                isInWatchlist={watchlist.has(film.id)}
                onSelect={() => onSelect(film.id)}
                onToggleWatchlist={() => onToggleWatchlist(film.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="glass flex flex-col items-center gap-2 rounded-3xl px-6 py-14 text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            {filter === 'watchlist'
              ? 'Save films to your watchlist and they will wait for you here.'
              : 'Paste a magnet link or drop a .torrent file to add a movie.'}
          </p>
        </div>
      )}
    </section>
  )
}
