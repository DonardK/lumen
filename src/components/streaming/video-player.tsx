import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { mediaUrl } from '@/lib/assets'
import type { Film } from '@/lib/films'
import { formatBytes, formatSpeed, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApiError, PlaybackMode, TorrentFileInfo, TorrentStats } from '@/types'
import { TrackSlider } from './track-slider'

const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75]
const IDLE_DELAY_MS = 2600

export type PlayerPhase =
  | 'idle'
  | 'discovering'
  | 'selecting'
  | 'preparing'
  | 'optimizing'
  | 'buffering'
  | 'ready'

const STATUS_COPY: Record<
  Exclude<PlayerPhase, 'idle' | 'selecting' | 'ready'>,
  { title: string; body: string }
> = {
  discovering: {
    title: 'Finding peers',
    body: 'Looking for people who have this torrent. That can take a few seconds.',
  },
  preparing: {
    title: 'Checking the file',
    body: 'Reading the start of the video to see whether it can play directly.',
  },
  buffering: {
    title: 'Waiting for the first bytes',
    body: 'Pieces are on the way. Playback starts as soon as the beginning arrives.',
  },
  optimizing: {
    title: 'Optimizing for playback',
    body: 'This file needs a quick conversion before it can play. Usually a few seconds.',
  },
}

const ERROR_TITLE: Record<string, string> = {
  'invalid-magnet': 'Invalid link',
  'no-peers': 'No peers',
  'no-playable-file': 'No playable video',
  ffmpeg: 'Playback optimization failed',
  unknown: 'Couldn’t start playback',
}

type VideoPlayerProps = {
  film: Film
  autoPlay: boolean
  onEnded: () => void
  streamUrl: string
  mode: PlaybackMode | null
  phase: PlayerPhase
  error: ApiError | null
  torrentProgress: number
  fileChoices: TorrentFileInfo[] | null
  onSelectFile: (index: number) => void
  onRequestPlay: () => void
  onProgress: (currentTime: number, duration: number) => void
  onCommit: () => void
  resumeAt: number
  knownDuration: number
  onPlaybackReady: () => void
  stats?: TorrentStats | null
}

function withSeek(streamUrl: string, seconds: number) {
  const url = new URL(streamUrl)
  url.searchParams.set('t', String(Math.max(0, seconds)))
  return url.toString()
}

export function VideoPlayer({
  film,
  autoPlay,
  onEnded,
  streamUrl,
  mode,
  phase,
  error,
  torrentProgress,
  fileChoices,
  onSelectFile,
  onRequestPlay,
  onProgress,
  onCommit,
  resumeAt,
  knownDuration,
  onPlaybackReady,
  stats,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const idleTimer = useRef<number | undefined>(undefined)
  const resumeRef = useRef(resumeAt)
  const autoPlayRef = useRef(autoPlay)
  const didResume = useRef(false)
  const onProgressRef = useRef(onProgress)
  resumeRef.current = resumeAt
  autoPlayRef.current = autoPlay
  onProgressRef.current = onProgress

  const [hasStarted, setHasStarted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [mediaTime, setMediaTime] = useState(0)
  const [offset, setOffset] = useState(0)
  const [duration, setDuration] = useState(knownDuration || film.durationSeconds)
  const [volume, setVolume] = useState(() => {
    const stored = Number(window.localStorage.getItem('lumen:volume'))
    return Number.isFinite(stored) && stored > 0 ? Math.min(1, stored) : 0.8
  })
  const [isMuted, setIsMuted] = useState(() => window.localStorage.getItem('lumen:muted') === '1')
  const [rateIndex, setRateIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [canPip, setCanPip] = useState(false)

  const displayTime = mode === 'transcode' ? offset + mediaTime : mediaTime
  const buffered =
    duration > 0 ? Math.min(duration, Math.max(0, torrentProgress) * duration) : 0

  useEffect(() => {
    if (knownDuration > 0) {
      setDuration((current) => (current > 0 ? current : knownDuration))
    }
  }, [knownDuration])

  useEffect(() => {
    onProgressRef.current(displayTime, duration)
  }, [displayTime, duration])

  useEffect(() => {
    setCanPip(
      typeof document !== 'undefined' && !!document.pictureInPictureEnabled,
    )
    const onFullscreenChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.clearTimeout(idleTimer.current)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return
    didResume.current = false
    const startAt = mode === 'transcode' ? resumeRef.current : 0
    setOffset(startAt)
    setMediaTime(0)
    setHasStarted(autoPlayRef.current)
    video.src = mode === 'transcode' ? withSeek(streamUrl, startAt) : streamUrl
    if (autoPlayRef.current) video.play().catch(() => setIsPlaying(false))
    return () => {
      video.pause()
    }
  }, [streamUrl, mode])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = isMuted
    window.localStorage.setItem('lumen:volume', String(volume))
    window.localStorage.setItem('lumen:muted', isMuted ? '1' : '0')
  }, [volume, isMuted])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = PLAYBACK_RATES[rateIndex]
  }, [rateIndex])

  function wake() {
    setIsIdle(false)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIsIdle(true), IDLE_DELAY_MS)
  }

  function togglePlay() {
    const video = videoRef.current
    if (!streamUrl) {
      onRequestPlay()
      return
    }
    if (!video) return
    setHasStarted(true)
    if (video.paused) video.play().catch(() => setIsPlaying(false))
    else {
      video.pause()
      onCommit()
    }
  }

  function seekTo(time: number) {
    const limit = duration > 0 ? duration : time
    const next = Math.min(Math.max(0, time), limit)
    const video = videoRef.current
    if (!video) return
    if (mode === 'transcode' && streamUrl) {
      setOffset(next)
      setMediaTime(0)
      setIsWaiting(true)
      video.src = withSeek(streamUrl, next)
      void video.play().catch(() => setIsPlaying(false))
      return
    }
    video.currentTime = next
    setMediaTime(video.currentTime)
  }

  function toggleMute() {
    if (isMuted || volume === 0) {
      setIsMuted(false)
      if (volume === 0) setVolume(0.6)
    } else {
      setIsMuted(true)
    }
  }

  function toggleFullscreen() {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) document.exitFullscreen()
    else container.requestFullscreen?.()
  }

  async function togglePip() {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await video.requestPictureInPicture()
    } catch {
      setCanPip(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const isRange = (event.target as HTMLElement).tagName === 'INPUT'
    switch (event.key) {
      case ' ':
      case 'k':
        event.preventDefault()
        togglePlay()
        break
      case 'm':
        toggleMute()
        break
      case 'f':
        toggleFullscreen()
        break
      case 'ArrowLeft':
        if (isRange) return
        event.preventDefault()
        seekTo(displayTime - 10)
        break
      case 'ArrowRight':
        if (isRange) return
        event.preventDefault()
        seekTo(displayTime + 10)
        break
      default:
        return
    }
    wake()
  }

  const effectiveVolume = isMuted ? 0 : volume
  const VolumeIcon =
    effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2
  const showChrome = !isPlaying || !isIdle
  const startupPhase =
    phase === 'discovering' ||
    phase === 'preparing' ||
    phase === 'buffering' ||
    phase === 'optimizing'
      ? phase
      : null
  const showStartup = startupPhase !== null && !error && !fileChoices
  const kicker = film.progressSeconds > 1 ? 'Continue watching' : 'Ready to play'

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`${film.title} video player`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onPointerMove={wake}
      onPointerLeave={() => isPlaying && setIsIdle(true)}
      className={cn(
        'group/player glass relative aspect-video w-full overflow-hidden rounded-3xl p-0 outline-none',
        isFullscreen && 'rounded-none border-0',
        !showChrome && 'cursor-none',
      )}
    >
      <video
        ref={videoRef}
        poster={mediaUrl(film.poster)}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setIsPlaying(true)
          setHasStarted(true)
          wake()
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsWaiting(true)}
        onPlaying={() => {
          setIsWaiting(false)
          onPlaybackReady()
        }}
        onCanPlay={() => {
          setIsWaiting(false)
          onPlaybackReady()
        }}
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration
          if (Number.isFinite(nextDuration) && nextDuration > 0) setDuration(nextDuration)
          if (mode !== 'transcode' && !didResume.current && resumeRef.current > 1) {
            didResume.current = true
            const target = resumeRef.current
            if (!Number.isFinite(nextDuration) || target < nextDuration - 5) {
              event.currentTarget.currentTime = target
            }
          }
        }}
        onTimeUpdate={(event) => setMediaTime(event.currentTarget.currentTime)}
        onEnded={onEnded}
        className="size-full bg-background object-contain"
      >
        <track kind="captions" />
      </video>

      {!hasStarted && !showStartup && !error && !fileChoices && (
        <div className="absolute inset-0">
          <img
            src={mediaUrl(film.poster)}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/20 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={togglePlay}
              className="glass flex size-20 items-center justify-center rounded-full text-foreground transition-transform hover:scale-105 focus-visible:outline-2 sm:size-24"
            >
              <Play className="size-8 translate-x-0.5 fill-current" aria-hidden="true" />
              <span className="sr-only">Play {film.title}</span>
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              {film.magnetURI ? kicker : 'Paste a magnet to start'}
            </p>
            <p className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              {film.title}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="absolute inset-0 flex items-center justify-center bg-background/75 p-6 text-center"
        >
          <div className="glass flex max-w-md flex-col gap-2 rounded-3xl px-6 py-5">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              {ERROR_TITLE[error.code] || ERROR_TITLE.unknown}
            </p>
            <p className="text-sm text-pretty text-muted-foreground">{error.message}</p>
          </div>
        </div>
      )}

      {fileChoices && fileChoices.length > 0 && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/75 p-4">
          <div className="glass flex max-h-full w-full max-w-lg flex-col gap-3 overflow-auto rounded-3xl p-4">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              Choose a file
            </p>
            <ul className="flex flex-col gap-2">
              {fileChoices.map((file) => (
                <li key={file.index}>
                  <button
                    type="button"
                    onClick={() => onSelectFile(file.index)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-glass-strong px-3 py-3 text-left text-sm hover:bg-foreground/15"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatBytes(file.length)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showStartup && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-background/55 p-6 text-center"
        >
          <div className="glass flex max-w-md flex-col items-center gap-3 rounded-3xl px-6 py-5">
            <span className="size-12 animate-spin rounded-full border-2 border-foreground/20 border-t-primary" />
            <p className="text-lg font-medium">{startupPhase ? STATUS_COPY[startupPhase].title : ''}</p>
            <p className="text-sm text-pretty text-muted-foreground">
              {startupPhase ? STATUS_COPY[startupPhase].body : ''}
            </p>
          </div>
        </div>
      )}

      {hasStarted && isWaiting && !showStartup && mode === 'transcode' && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-background/45 p-6 text-center"
        >
          <div className="glass flex max-w-sm flex-col items-center gap-2 rounded-3xl px-6 py-5">
            <span className="size-10 animate-spin rounded-full border-2 border-foreground/20 border-t-primary" />
            <p className="font-medium">Optimizing for playback</p>
          </div>
        </div>
      )}

      {hasStarted && isWaiting && !showStartup && mode !== 'transcode' && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="size-12 animate-spin rounded-full border-2 border-foreground/20 border-t-primary" />
          <span className="sr-only">Buffering</span>
        </div>
      )}

      {hasStarted && (
        <>
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 flex items-center p-3 transition-opacity duration-300 sm:p-4',
              showChrome ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span className="glass-subtle flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="hidden shrink-0 text-muted-foreground sm:inline">Now playing</span>
              <span className="truncate font-medium">{film.title}</span>
            </span>
            {stats && !stats.paused && stats.downloadSpeed > 0 ? (
              <span className="glass-subtle ml-auto flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs tabular-nums">
                <span className="text-muted-foreground">{stats.numPeers} peers</span>
                <span className="text-foreground">{formatSpeed(stats.downloadSpeed)}</span>
              </span>
            ) : null}
          </div>

          <div
            className={cn(
              'glass absolute inset-x-2 bottom-2 flex flex-col gap-1 rounded-2xl px-3 pt-2 pb-2 transition-[opacity,translate] duration-300 sm:inset-x-4 sm:bottom-4 sm:px-4',
              showChrome
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-2 opacity-0',
            )}
          >
            <TrackSlider
              label="Seek"
              value={displayTime}
              max={duration}
              buffered={buffered}
              valueText={`${formatTime(displayTime)} of ${formatTime(duration)}`}
              onChange={seekTo}
            />

            <div className="flex items-center gap-1 sm:gap-2">
              <ControlButton label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
                {isPlaying ? (
                  <Pause className="size-5 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="size-5 fill-current" aria-hidden="true" />
                )}
              </ControlButton>
              <ControlButton
                label="Back 10 seconds"
                onClick={() => seekTo(displayTime - 10)}
                className="hidden sm:flex"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
              </ControlButton>
              <ControlButton
                label="Forward 10 seconds"
                onClick={() => seekTo(displayTime + 10)}
                className="hidden sm:flex"
              >
                <RotateCw className="size-4" aria-hidden="true" />
              </ControlButton>

              <div className="flex items-center gap-1">
                <ControlButton
                  label={effectiveVolume === 0 ? 'Unmute' : 'Mute'}
                  onClick={toggleMute}
                >
                  <VolumeIcon className="size-5" aria-hidden="true" />
                </ControlButton>
                <TrackSlider
                  label="Volume"
                  value={effectiveVolume}
                  max={1}
                  step={0.01}
                  valueText={`${Math.round(effectiveVolume * 100)}%`}
                  onChange={(next) => {
                    setVolume(next)
                    setIsMuted(next === 0)
                  }}
                  className="hidden w-20 sm:flex"
                />
              </div>

              <p className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
                <span className="text-foreground">{formatTime(displayTime)}</span>
                {' / '}
                {formatTime(duration)}
              </p>

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRateIndex((i) => (i + 1) % PLAYBACK_RATES.length)}
                  aria-label={`Playback speed ${PLAYBACK_RATES[rateIndex]}x`}
                  className="flex h-9 min-w-12 items-center justify-center rounded-lg px-2 font-mono text-xs text-foreground transition-colors hover:bg-glass-strong"
                >
                  {PLAYBACK_RATES[rateIndex]}x
                </button>
                {canPip && (
                  <ControlButton
                    label="Picture in picture"
                    onClick={togglePip}
                    className="hidden sm:flex"
                  >
                    <PictureInPicture2 className="size-4" aria-hidden="true" />
                  </ControlButton>
                )}
                <ControlButton
                  label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize className="size-4" aria-hidden="true" />
                  ) : (
                    <Maximize className="size-4" aria-hidden="true" />
                  )}
                </ControlButton>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-glass-strong focus-visible:outline-2',
        className,
      )}
    >
      {children}
    </button>
  )
}
