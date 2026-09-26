import { Bookmark, BookmarkCheck, Play } from 'lucide-react'
import { mediaUrl } from '@/lib/assets'
import type { Film } from '@/lib/films'
import { formatRuntime, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type MediaCardProps = {
  film: Film
  isCurrent: boolean
  isInWatchlist: boolean
  onSelect: () => void
  onToggleWatchlist: () => void
}

export function MediaCard({
  film,
  isCurrent,
  isInWatchlist,
  onSelect,
  onToggleWatchlist,
}: MediaCardProps) {
  const progress =
    film.durationSeconds > 0
      ? Math.min(100, (film.progressSeconds / film.durationSeconds) * 100)
      : 0

  return (
    <article className="group relative flex flex-col gap-3">
      <div
        className={cn(
          'relative aspect-video overflow-hidden rounded-2xl border border-glass-border bg-glass transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_40px_-20px_var(--glass-shadow)]',
          isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <img
          src={mediaUrl(film.poster)}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background/70 via-transparent to-transparent" />

        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-has-focus-visible:opacity-100">
          <span className="glass flex size-12 items-center justify-center rounded-full">
            <Play className="size-5 translate-x-px fill-current" aria-hidden="true" />
          </span>
        </span>

        {isCurrent ? (
          <span className="glass-subtle absolute bottom-2.5 left-2.5 flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium">
            <Equalizer />
            Now playing
          </span>
        ) : null}

        <span className="glass-subtle absolute right-2.5 bottom-2.5 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums">
          {formatTime(film.durationSeconds)}
        </span>

        {progress > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20">
            <span className="block h-full bg-primary" style={{ width: `${progress}%` }} />
          </span>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate font-medium">
            <button
              type="button"
              onClick={onSelect}
              className="text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-ring"
            >
              {film.title}
            </button>
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {[film.year || null, film.genre || 'Movie', film.durationSeconds ? formatRuntime(film.durationSeconds) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleWatchlist}
          aria-pressed={isInWatchlist}
          aria-label={
            isInWatchlist
              ? `Remove ${film.title} from watchlist`
              : `Add ${film.title} to watchlist`
          }
          className={cn(
            'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-glass-strong',
            isInWatchlist ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {isInWatchlist ? (
            <BookmarkCheck className="size-4" aria-hidden="true" />
          ) : (
            <Bookmark className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </article>
  )
}

function Equalizer() {
  return (
    <span aria-hidden="true" className="flex h-3 items-end gap-0.5">
      {[0, 180, 360].map((delay) => (
        <span
          key={delay}
          className="h-full w-0.5 origin-bottom rounded-full bg-primary animate-[equalize_0.9s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}
