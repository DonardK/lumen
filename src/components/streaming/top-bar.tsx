import { Aperture, FolderOpen, Link2, Play, Settings } from 'lucide-react'
import { useEffect, useRef } from 'react'

type TopBarProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  onPickFile: () => void
  onOpenSettings: () => void
  busy: boolean
}

export function TopBar({
  value,
  onValueChange,
  onSubmit,
  onPickFile,
  onOpenSettings,
  busy,
}: TopBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
        <Aperture className="size-5" aria-hidden="true" />
        <span className="sr-only">Lumen</span>
      </span>

      <form
        className="flex min-w-0 flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(value)
        }}
      >
        <label className="glass-subtle flex h-11 max-w-xl flex-1 items-center gap-2.5 rounded-full px-4 focus-within:outline-2 focus-within:outline-ring">
          <Link2
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Magnet link or torrent URL</span>
          <input
            ref={inputRef}
            type="text"
            enterKeyHint="go"
            value={value}
            spellCheck={false}
            onChange={(event) => onValueChange(event.target.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text').trim()
              if (/^magnet:\?/i.test(text) || /^https?:\/\//i.test(text)) {
                event.preventDefault()
                onValueChange(text)
                onSubmit(text)
              }
            }}
            placeholder="Paste a magnet link or .torrent URL  ( / )"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy || value.trim() === ''}
          aria-label="Play magnet link"
          className="glass-subtle flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary disabled:opacity-40"
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onPickFile}
          disabled={busy}
          aria-label="Open a torrent file"
          className="glass-subtle flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <FolderOpen className="size-4" aria-hidden="true" />
        </button>
      </form>

      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Settings"
        title="Settings"
        className="glass-subtle relative ml-auto flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground lg:hidden"
      >
        <Settings className="size-4" aria-hidden="true" />
      </button>
    </header>
  )
}
