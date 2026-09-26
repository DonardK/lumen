import { Bookmark, BookmarkCheck, Check, Play, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { mediaUrl } from '@/lib/assets'
import type { Film } from '@/lib/films'
import { formatRuntime } from '@/lib/format'
import { cn } from '@/lib/utils'

type NowPlayingDetailsProps = {
  film: Film
  upNext: Film | null
  isInWatchlist: boolean
  onToggleWatchlist: () => void
  onPlayNext: () => void
  onRemove: () => void
}

export function NowPlayingDetails({
  film,
  upNext,
  isInWatchlist,
  onToggleWatchlist,
  onPlayNext,
  onRemove,
}: NowPlayingDetailsProps) {
  const [copied, setCopied] = useState(false)
  const chips = [
    film.year ? String(film.year) : '',
    film.durationSeconds ? formatRuntime(film.durationSeconds) : '',
    film.genre,
    film.director ? `Dir. ${film.director}` : '',
  ].filter(Boolean)

  async function share() {
    const text = film.magnetURI || film.title
    try {
      if (navigator.share && film.magnetURI) {
        await navigator.share({ title: film.title, text: film.magnetURI })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // User dismissed the share sheet or clipboard access was denied.
    }
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="glass flex flex-1 flex-col gap-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {film.title}
          </h1>
          {chips.length > 0 && (
            <ul className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              {chips.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-glass-border px-2.5 py-1"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        {film.synopsis ? (
          <p className="max-w-3xl leading-relaxed text-pretty text-muted-foreground">
            {film.synopsis}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleWatchlist}
            aria-pressed={isInWatchlist}
            className={cn(
              'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
              isInWatchlist
                ? 'bg-primary text-primary-foreground'
                : 'bg-glass-strong text-foreground hover:bg-foreground/15',
            )}
          >
            {isInWatchlist ? (
              <BookmarkCheck className="size-4" aria-hidden="true" />
            ) : (
              <Bookmark className="size-4" aria-hidden="true" />
            )}
            {isInWatchlist ? 'In watchlist' : 'Add to watchlist'}
          </button>
          <button
            type="button"
            onClick={share}
            className="flex h-10 items-center gap-2 rounded-full bg-glass-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/15"
          >
            {copied ? (
              <Check className="size-4 text-primary" aria-hidden="true" />
            ) : (
              <Share2 className="size-4" aria-hidden="true" />
            )}
            <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
          </button>
          {film.magnetURI && (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-10 items-center gap-2 rounded-full bg-glass-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/15"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
      </div>

      {upNext && (
        <button
          type="button"
          onClick={onPlayNext}
          className="glass group flex items-center gap-4 rounded-3xl p-3 text-left transition-colors hover:bg-glass-strong xl:w-80 xl:flex-col xl:items-stretch xl:p-4"
        >
          <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-2xl sm:w-40 xl:w-full">
            <img
              src={mediaUrl(upNext.poster)}
              alt=""
              className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <span className="glass-subtle flex size-10 items-center justify-center rounded-full">
                <Play className="size-4 fill-current" aria-hidden="true" />
              </span>
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-primary">
              Up next
            </span>
            <span className="truncate font-medium">{upNext.title}</span>
            <span className="text-sm text-muted-foreground">
              {[upNext.genre || 'Movie', upNext.durationSeconds ? formatRuntime(upNext.durationSeconds) : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        </button>
      )}
    </div>
  )
}
