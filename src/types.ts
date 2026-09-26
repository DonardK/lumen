export type ErrorCode =
  | 'invalid-magnet'
  | 'no-peers'
  | 'no-playable-file'
  | 'ffmpeg'
  | 'unknown'

export type ApiError = {
  code: ErrorCode | string
  message: string
}

export type TorrentFileInfo = {
  index: number
  name: string
  length: number
}

export type FilmTag = 'animation' | 'live-action' | 'short'

export type LibraryEntry = {
  magnetURI: string
  title: string
  year: number
  posterUrl: string
  tmdbId: number | null
  fileIndex: number
  progressSeconds: number
  durationSeconds: number
  addedAt: string
  lastWatchedAt: string
  cachePath: string
  overview?: string
  genre?: string
  director?: string
  tags?: FilmTag[]
}

export type Settings = {
  cacheDir: string
  keepCacheOnClose: boolean
  tmdbApiKey: string
}

export type TorrentStats = {
  infoHash: string
  downloadSpeed: number
  numPeers: number
  progress: number
  downloaded: number
  total: number
  paused?: boolean
}

export type PlaybackMode = 'direct' | 'transcode'

export type AddTorrentResult =
  | {
      ok: true
      infoHash: string
      name: string
      files: TorrentFileInfo[]
      suggestedFileIndex: number
      entry: LibraryEntry
      resumed: boolean
    }
  | { ok: false; error: ApiError }

export type SelectFileResult =
  | {
      ok: true
      mode: PlaybackMode
      streamUrl: string
      duration: number | null
    }
  | { ok: false; error: ApiError }

export type ProgressPayload = {
  infoHash: string
  fileIndex: number
  currentTime: number
  duration: number
}

export interface DesktopApi {
  addTorrent(input: string): Promise<AddTorrentResult>
  selectFile(infoHash: string, fileIndex: number): Promise<SelectFileResult>
  removeTorrent(infoHash: string): Promise<{ ok: boolean; error?: ApiError }>
  pickTorrentFile(): Promise<
    { ok: true; path: string } | { ok: false; cancelled?: boolean; error?: ApiError }
  >
  getPathForFile(file: File): string
  pickCacheDir(): Promise<{ ok: true; path: string } | { ok: false; cancelled?: boolean }>
  getLibrary(): Promise<Record<string, LibraryEntry>>
  upsertLibrary(
    entry: { infoHash: string } & Partial<LibraryEntry>,
  ): Promise<{ ok: true; entry: LibraryEntry } | { ok: false; error: ApiError }>
  removeLibraryEntry(infoHash: string): Promise<{ ok: boolean }>
  getWatchlist(): Promise<string[]>
  toggleWatchlist(infoHash: string): Promise<string[]>
  getSettings(): Promise<Settings>
  updateSettings(partial: Partial<Settings>): Promise<Settings>
  saveProgress(payload: ProgressPayload): Promise<void>
  flushProgress(payload: ProgressPayload): void
  onStats(listener: (stats: TorrentStats) => void): () => void
  onTorrentError(
    listener: (payload: { infoHash: string; error: ApiError }) => void,
  ): () => void
}

declare global {
  interface Window {
    api?: DesktopApi
  }
}
