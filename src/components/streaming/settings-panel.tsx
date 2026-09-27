import { FolderOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Settings } from '@/types'

type SettingsPanelProps = {
  settings: Settings
  onChange: (partial: Partial<Settings>) => void
  onBrowseCacheDir: () => Promise<string>
  onClose: () => void
}

export function SettingsPanel({
  settings,
  onChange,
  onBrowseCacheDir,
  onClose,
}: SettingsPanelProps) {
  const [cacheDir, setCacheDir] = useState(settings.cacheDir)
  const [tmdbApiKey, setTmdbApiKey] = useState(settings.tmdbApiKey)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-heading"
      className="fixed inset-0 z-30 flex items-end justify-center p-3 sm:items-center"
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        className="glass relative flex w-full max-w-md flex-col gap-4 rounded-3xl p-5 duration-300 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 motion-reduce:animate-none"
        onSubmit={(event) => {
          event.preventDefault()
          onClose()
        }}
      >
        <div className="flex flex-col gap-1">
          <h2 id="settings-heading" className="text-lg font-semibold">
            Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Saved movies keep their downloaded pieces so playback can resume.
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          Cache folder
          <span className="flex items-center gap-2">
            <input
              value={cacheDir}
              spellCheck={false}
              onChange={(event) => {
                setCacheDir(event.target.value)
                onChange({ cacheDir: event.target.value.trim() })
              }}
              className="h-10 min-w-0 flex-1 rounded-xl border border-glass-border bg-background/40 px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-ring"
            />
            <button
              type="button"
              onClick={async () => {
                const path = await onBrowseCacheDir()
                if (!path) return
                setCacheDir(path)
                onChange({ cacheDir: path })
              }}
              aria-label="Browse for a cache folder"
              className="glass-subtle flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground"
            >
              <FolderOpen className="size-4" aria-hidden="true" />
            </button>
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.keepCacheOnClose}
            onChange={(event) => onChange({ keepCacheOnClose: event.target.checked })}
            className="size-4 shrink-0 appearance-none rounded-[6px] border border-glass-border bg-background/40 bg-center bg-no-repeat checked:border-primary checked:bg-primary checked:[background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%231a1c26%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%2220 6 9 17 4 12%22/></svg>')] checked:[background-size=70%] focus-visible:outline-2 focus-visible:outline-ring"
          />
          Keep downloaded pieces for library titles
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          TMDB API key
          <input
            type="password"
            value={tmdbApiKey}
            autoComplete="off"
            spellCheck={false}
            placeholder="Optional, or set TMDB_API_KEY in .env"
            onChange={(event) => {
              setTmdbApiKey(event.target.value)
              onChange({ tmdbApiKey: event.target.value })
            }}
            className="h-10 rounded-xl border border-glass-border bg-background/40 px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-ring"
          />
        </label>

        <button
          type="submit"
          className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Done
        </button>
      </form>
    </div>
  )
}
