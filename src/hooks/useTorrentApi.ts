import { useCallback, useEffect, useState } from 'react'
import type {
  ApiError,
  LibraryEntry,
  ProgressPayload,
  Settings,
  TorrentStats,
} from '@/types'

const EMPTY_SETTINGS: Settings = {
  cacheDir: '',
  keepCacheOnClose: true,
  tmdbApiKey: '',
}

export function useTorrentApi() {
  const [library, setLibrary] = useState<Record<string, LibraryEntry>>({})
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [statsByHash, setStatsByHash] = useState<Record<string, TorrentStats>>({})
  const [lastError, setLastError] = useState<{ infoHash: string; error: ApiError } | null>(
    null,
  )
  const [ready, setReady] = useState(false)
  const available = typeof window !== 'undefined' && Boolean(window.api)

  useEffect(() => {
    const api = window.api
    if (!api) {
      setReady(true)
      return
    }
    let cancelled = false
    void Promise.all([api.getLibrary(), api.getWatchlist(), api.getSettings()]).then(
      ([nextLibrary, nextWatchlist, nextSettings]) => {
        if (cancelled) return
        setLibrary(nextLibrary)
        setWatchlist(nextWatchlist)
        setSettings(nextSettings)
        setReady(true)
      },
    )
    const offStats = api.onStats((stats) => {
      setStatsByHash((prev) => ({ ...prev, [stats.infoHash]: stats }))
    })
    const offError = api.onTorrentError((payload) => setLastError(payload))
    return () => {
      cancelled = true
      offStats()
      offError()
    }
  }, [])

  const rememberEntry = useCallback((infoHash: string, entry: LibraryEntry) => {
    setLibrary((prev) => ({ ...prev, [infoHash]: entry }))
  }, [])

  const addTorrent = useCallback(
    async (input: string) => {
      const api = window.api
      if (!api) {
        return {
          ok: false as const,
          error: {
            code: 'unknown',
            message: 'Playback runs in the Lumen desktop window.',
          },
        }
      }
      const result = await api.addTorrent(input)
      if (result.ok) rememberEntry(result.infoHash, result.entry)
      return result
    },
    [rememberEntry],
  )

  const selectFile = useCallback(async (infoHash: string, fileIndex: number) => {
    const api = window.api
    if (!api) {
      return {
        ok: false as const,
        error: { code: 'unknown', message: 'Playback runs in the Lumen desktop window.' },
      }
    }
    return api.selectFile(infoHash, fileIndex)
  }, [])

  const removeTorrent = useCallback(async (infoHash: string) => {
    if (!window.api) return
    await window.api.removeTorrent(infoHash)
    setStatsByHash((prev) => {
      const next = { ...prev }
      delete next[infoHash]
      return next
    })
  }, [])

  const removeLibraryEntry = useCallback(async (infoHash: string) => {
    if (!window.api) return
    await window.api.removeLibraryEntry(infoHash)
    setLibrary((prev) => {
      const next = { ...prev }
      delete next[infoHash]
      return next
    })
    setWatchlist((prev) => prev.filter((id) => id !== infoHash))
  }, [])

  const toggleWatchlist = useCallback(async (infoHash: string) => {
    if (!window.api) {
      setWatchlist((prev) =>
        prev.includes(infoHash) ? prev.filter((id) => id !== infoHash) : [...prev, infoHash],
      )
      return
    }
    const next = await window.api.toggleWatchlist(infoHash)
    setWatchlist(next)
  }, [])

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    if (!window.api) return
    const next = await window.api.updateSettings(partial)
    setSettings(next)
  }, [])

  const saveProgress = useCallback(async (payload: ProgressPayload) => {
    if (!window.api || !payload.infoHash) return
    await window.api.saveProgress(payload)
    setLibrary((prev) => {
      const entry = prev[payload.infoHash]
      if (!entry) return prev
      return {
        ...prev,
        [payload.infoHash]: {
          ...entry,
          fileIndex: payload.fileIndex,
          progressSeconds: payload.currentTime,
          durationSeconds: payload.duration || entry.durationSeconds,
          lastWatchedAt: new Date().toISOString(),
        },
      }
    })
  }, [])

  const flushProgress = useCallback((payload: ProgressPayload) => {
    if (!window.api || !payload.infoHash) return
    window.api.flushProgress(payload)
  }, [])

  const pickTorrentFile = useCallback(async () => {
    if (!window.api) return { ok: false as const, cancelled: true }
    return window.api.pickTorrentFile()
  }, [])

  const pickCacheDir = useCallback(async () => {
    if (!window.api) return { ok: false as const, cancelled: true }
    return window.api.pickCacheDir()
  }, [])

  const getPathForFile = useCallback((file: File) => {
    return window.api?.getPathForFile(file) || ''
  }, [])

  const clearError = useCallback(() => setLastError(null), [])

  return {
    available,
    ready,
    library,
    watchlist,
    settings,
    statsByHash,
    lastError,
    clearError,
    addTorrent,
    selectFile,
    removeTorrent,
    removeLibraryEntry,
    toggleWatchlist,
    updateSettings,
    saveProgress,
    flushProgress,
    pickTorrentFile,
    pickCacheDir,
    getPathForFile,
  }
}
