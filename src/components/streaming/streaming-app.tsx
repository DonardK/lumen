import { useEffect, useMemo, useRef, useState } from 'react'
import { useTorrentApi } from '@/hooks/useTorrentApi'
import { toFilm, type Film } from '@/lib/films'
import type { ApiError, PlaybackMode, TorrentFileInfo } from '@/types'
import { AmbientBackdrop } from './ambient-backdrop'
import { type LibraryFilter, matchesFilter } from './library-nav'
import { MediaGrid } from './media-grid'
import { MobileNav } from './mobile-nav'
import { NowPlayingDetails } from './now-playing-details'
import { SettingsPanel } from './settings-panel'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { VideoPlayer, type PlayerPhase } from './video-player'

const EMPTY_FILM: Film = {
  id: 'idle',
  title: 'Paste a magnet to play',
  year: 0,
  director: '',
  genre: '',
  tags: [],
  durationSeconds: 0,
  synopsis: '',
  poster: '',
  magnetURI: '',
  progressSeconds: 0,
  fileIndex: 0,
  lastWatchedAt: '',
}

type Session = {
  infoHash: string
  fileIndex: number
  mode: PlaybackMode
  streamUrl: string
  duration: number | null
}

export function StreamingApp() {
  const api = useTorrentApi()
  const {
    addTorrent,
    selectFile,
    removeTorrent,
    removeLibraryEntry,
    toggleWatchlist,
    updateSettings,
    saveProgress,
    flushProgress,
    pickTorrentFile,
    getPathForFile,
    clearError,
  } = api
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false)
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [magnet, setMagnet] = useState('')
  const [phase, setPhase] = useState<PlayerPhase>('idle')
  const [session, setSession] = useState<Session | null>(null)
  const [choices, setChoices] = useState<TorrentFileInfo[] | null>(null)
  const [pendingHash, setPendingHash] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const requestRef = useRef(0)
  const pickedInitial = useRef(false)
  const playbackRef = useRef({
    infoHash: '',
    fileIndex: 0,
    currentTime: 0,
    duration: 0,
  })
  const beginRef = useRef<
    (input: string, preferredFileIndex?: number, resumed?: boolean) => Promise<void>
  >(async () => {})

  const watchlist = useMemo(() => new Set(api.watchlist), [api.watchlist])
  const films = useMemo(
    () =>
      Object.entries(api.library)
        .map(([infoHash, entry]) => toFilm(infoHash, entry))
        .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt)),
    [api.library],
  )
  const visibleFilms = useMemo(
    () => films.filter((film) => matchesFilter(film, filter, watchlist)),
    [films, filter, watchlist],
  )
  const current = films.find((film) => film.id === currentId) ?? null
  const currentIndex = current ? films.findIndex((film) => film.id === current.id) : -1
  const upNext = films.length > 1 && currentIndex >= 0
    ? films[(currentIndex + 1) % films.length]
    : null
  const shown = current ?? EMPTY_FILM
  const activeStats = session ? api.statsByHash[session.infoHash] : undefined
  const downloadCount = Object.values(api.statsByHash).filter(
    (stats) => !stats.paused && stats.progress < 0.999,
  ).length
  const busy = phase === 'discovering' || phase === 'preparing'

  useEffect(() => {
    if (pickedInitial.current || films.length === 0) return
    pickedInitial.current = true
    setCurrentId(films[0].id)
  }, [films])

  useEffect(() => {
    if (!api.lastError) return
    const relevant =
      api.lastError.infoHash === pendingHash || api.lastError.infoHash === session?.infoHash
    if (!relevant && pendingHash) return
    setError(api.lastError.error)
    if (api.lastError.error.code === 'no-peers' || api.lastError.error.code === 'ffmpeg') {
      setPhase('idle')
    }
  }, [api.lastError, pendingHash, session?.infoHash])

  useEffect(() => {
    if (error?.code !== 'no-peers' || !currentId) return
    const stats = api.statsByHash[currentId]
    if (stats && (stats.numPeers > 0 || stats.downloaded > 0)) setError(null)
  }, [api.statsByHash, currentId, error])

  useEffect(() => {
    if (!session) return
    playbackRef.current = {
      ...playbackRef.current,
      infoHash: session.infoHash,
      fileIndex: session.fileIndex,
      duration: session.duration || playbackRef.current.duration,
    }
  }, [session])

  useEffect(() => {
    const flush = () => {
      const snap = playbackRef.current
      if (!snap.infoHash) return
      flushProgress(snap)
    }
    const id = window.setInterval(() => {
      const snap = playbackRef.current
      if (!snap.infoHash) return
      void saveProgress(snap)
    }, 5000)
    window.addEventListener('beforeunload', flush)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [flushProgress, saveProgress, session?.infoHash, session?.fileIndex])

  useEffect(() => {
    function onDragOver(event: DragEvent) {
      if (![...(event.dataTransfer?.items || [])].some((item) => item.kind === 'file')) return
      event.preventDefault()
      setDragging(true)
    }
    function onDragLeave() {
      setDragging(false)
    }
    async function onDrop(event: DragEvent) {
      event.preventDefault()
      setDragging(false)
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.torrent')) {
        setError({
          code: 'invalid-magnet',
          message: 'Drop a .torrent file, or paste a magnet link.',
        })
        return
      }
      const filePath = getPathForFile(file)
      if (!filePath) {
        setError({
          code: 'unknown',
          message: 'Open torrent files from the Lumen desktop window.',
        })
        return
      }
      await beginRef.current(filePath)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [getPathForFile])

  async function begin(input: string, preferredFileIndex?: number, resumed = false) {
    const id = ++requestRef.current
    const previous = playbackRef.current
    if (previous.infoHash) void saveProgress(previous)
    setError(null)
    clearError()
    setSession(null)
    setChoices(null)
    setPhase('discovering')
    playbackRef.current = { infoHash: '', fileIndex: 0, currentTime: 0, duration: 0 }
    const added = await addTorrent(input.trim())
    if (id !== requestRef.current) return
    if (!added.ok) {
      setPhase('idle')
      setError(added.error)
      return
    }
    setPendingHash(added.infoHash)
    setCurrentId(added.infoHash)
    setMagnet('')
    const fileIndex = resumed || added.resumed
      ? added.entry.fileIndex
      : preferredFileIndex
    if (!added.resumed && !resumed && added.files.length > 1 && preferredFileIndex == null) {
      setChoices(added.files)
      setPhase('selecting')
      return
    }
    await playFile(
      added.infoHash,
      fileIndex ?? added.suggestedFileIndex,
      id,
      added.entry.progressSeconds,
    )
  }

  beginRef.current = begin

  async function playFile(
    infoHash: string,
    fileIndex: number,
    requestId = requestRef.current,
    resumeAt = 0,
  ) {
    setChoices(null)
    setPhase('preparing')
    const selected = await selectFile(infoHash, fileIndex)
    if (requestId !== requestRef.current) return
    if (!selected.ok) {
      setPhase('idle')
      setError(selected.error)
      return
    }
    setSession({
      infoHash,
      fileIndex,
      mode: selected.mode,
      streamUrl: selected.streamUrl,
      duration: selected.duration,
    })
    setPhase(selected.mode === 'transcode' ? 'optimizing' : 'buffering')
    if (selected.duration && selected.duration > 0) {
      void saveProgress({
        infoHash,
        fileIndex,
        currentTime: resumeAt,
        duration: selected.duration,
      })
    }
  }

  function playSaved(film: Film) {
    setCurrentId(film.id)
    setShouldAutoPlay(true)
    void begin(film.magnetURI, film.fileIndex, true)
  }

  async function removeCurrent() {
    if (!current) return
    const infoHash = current.id
    requestRef.current += 1
    setSession(null)
    setPhase('idle')
    setCurrentId(null)
    await api.removeLibraryEntry(infoHash)
    await api.removeTorrent(infoHash)
  }

  const playerFilm: Film = {
    ...shown,
    durationSeconds: session?.duration || shown.durationSeconds,
    progressSeconds: shown.progressSeconds,
  }

  return (
    <div className="relative isolate flex min-h-dvh">
      <AmbientBackdrop film={shown} />
      {dragging && (
        <div className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-3xl border border-dashed border-primary bg-background/70">
          <p className="font-medium">Drop a .torrent file to play it</p>
        </div>
      )}

      <Sidebar
        filter={filter}
        onFilterChange={setFilter}
        watchlistCount={watchlist.size}
        downloadCount={downloadCount}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-6 p-3 pb-28 sm:p-5 sm:pb-28 lg:py-3 lg:pr-4 lg:pb-10 lg:pl-1">
        <TopBar
          value={magnet}
          onValueChange={setMagnet}
          onSubmit={(value) => {
            setShouldAutoPlay(true)
            void begin(value)
          }}
          onPickFile={() => {
            void api.pickTorrentFile().then((picked) => {
              if (!picked.ok || !('path' in picked) || !picked.path) return
              setShouldAutoPlay(true)
              void begin(picked.path)
            })
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          busy={busy}
        />

        <main className="flex flex-col gap-10">
          <section
            aria-label={`Now playing: ${shown.title}`}
            className="flex scroll-mt-4 flex-col gap-4"
          >
            <VideoPlayer
              key={shown.id}
              film={playerFilm}
              autoPlay={shouldAutoPlay}
              onEnded={() => {
                if (upNext && upNext.id !== shown.id) playSaved(upNext)
              }}
              streamUrl={session?.infoHash === shown.id ? session.streamUrl : ''}
              mode={session?.infoHash === shown.id ? session.mode : null}
              phase={phase}
              error={error}
              torrentProgress={activeStats?.progress ?? 0}
              fileChoices={phase === 'selecting' ? choices : null}
              onSelectFile={(index) => {
                if (!pendingHash) return
                setShouldAutoPlay(true)
                void playFile(pendingHash, index)
              }}
              onRequestPlay={() => {
                if (!current?.magnetURI) {
                  setError({
                    code: 'invalid-magnet',
                    message: 'Paste a magnet link or .torrent URL to start watching.',
                  })
                  return
                }
                setShouldAutoPlay(true)
                playSaved(current)
              }}
              onProgress={(currentTime, duration) => {
                playbackRef.current = {
                  infoHash: session?.infoHash || '',
                  fileIndex: session?.fileIndex || 0,
                  currentTime,
                  duration,
                }
              }}
              onCommit={() => {
                const snap = playbackRef.current
                if (snap.infoHash) void api.saveProgress(snap)
              }}
              resumeAt={shown.progressSeconds}
              knownDuration={session?.duration || shown.durationSeconds}
              stats={activeStats}
              onPlaybackReady={() => {
                if (phase === 'optimizing' || phase === 'buffering' || phase === 'preparing') {
                  setPhase('ready')
                }
              }}
            />
            {current && (
              <NowPlayingDetails
                film={current}
                upNext={upNext && upNext.id !== current.id ? upNext : null}
                isInWatchlist={watchlist.has(current.id)}
                onToggleWatchlist={() => void api.toggleWatchlist(current.id)}
                onPlayNext={() => upNext && playSaved(upNext)}
                onRemove={() => void removeCurrent()}
              />
            )}
          </section>

          <MediaGrid
            films={visibleFilms}
            currentId={current?.id || ''}
            filter={filter}
            onFilterChange={setFilter}
            watchlist={watchlist}
            onSelect={(id) => {
              const film = films.find((item) => item.id === id)
              if (film) playSaved(film)
            }}
            onToggleWatchlist={(id) => void api.toggleWatchlist(id)}
          />
        </main>
      </div>

      <MobileNav filter={filter} onFilterChange={setFilter} />

      {settingsOpen && (
        <SettingsPanel
          settings={api.settings}
          onChange={(partial) => void api.updateSettings(partial)}
          onBrowseCacheDir={async () => {
            const picked = await api.pickCacheDir()
            return picked.ok && 'path' in picked ? picked.path : ''
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
