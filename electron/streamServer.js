const SIMILAR_SIZE_RATIO = 0.7

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mkv',
  '.webm',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.ts',
  '.m2ts',
  '.mts',
  '.mpeg',
  '.mpg',
  '.ogv',
  '.ogm',
  '.vob',
  '.3gp',
])

function extensionOf(name) {
  const base = String(name).split(/[/\\]/).pop() || ''
  const dot = base.lastIndexOf('.')
  return dot === -1 ? '' : base.slice(dot).toLowerCase()
}

function isVideoFile(file) {
  const base = String(file.path || file.name).split(/[/\\]/).pop() || ''
  if (/^sample\b/i.test(base)) return false
  return VIDEO_EXTENSIONS.has(extensionOf(base))
}

function listVideoFiles(torrent) {
  return torrent.files
    .map((file, index) => ({
      index,
      name: file.path || file.name,
      length: file.length,
      file,
    }))
    .filter((entry) => entry.length > 0 && isVideoFile(entry.file))
    .sort((a, b) => b.length - a.length)
}

/**
 * Largest video wins. When other videos are within 70% of that size,
 * the renderer should ask which cut or episode to play.
 */
function chooseVideoFiles(torrent) {
  const videos = listVideoFiles(torrent)
  if (videos.length === 0) {
    const error = new Error('This torrent does not contain a playable video file.')
    error.code = 'no-playable-file'
    throw error
  }

  const largest = videos[0]
  const similar = videos.filter((entry) => entry.length >= largest.length * SIMILAR_SIZE_RATIO)
  const needsSelection = similar.length > 1
  const chosen = needsSelection ? similar : [largest]

  return {
    needsSelection,
    suggestedFileIndex: largest.index,
    files: chosen.map(({ index, name, length }) => ({ index, name, length })),
  }
}

function pieceRange(torrent, file) {
  const pieceLength = torrent.pieceLength || 1
  const start = Math.floor(file.offset / pieceLength)
  const end = Math.floor((file.offset + Math.max(file.length, 1) - 1) / pieceLength)
  return {
    start: Math.max(0, start),
    end: Math.min(end, Math.max(0, torrent.pieces.length - 1)),
  }
}

function deselectRange(torrent, start, end, priority) {
  if (torrent.pieces.length === 0 || end < start) return
  try {
    torrent.deselect(start, end, priority)
  } catch {
    // Missing selections are already gone.
  }
}

/**
 * Download the chosen file first, with the opening 5% and closing 1%
 * marked critical so playback and duration (often the moov atom) arrive early.
 */
function prioritizePlayback(torrent, file) {
  const lastPiece = torrent.pieces.length - 1
  if (lastPiece < 0 || file.length === 0) return

  deselectRange(torrent, 0, lastPiece, 0)
  for (const other of torrent.files) {
    const range = pieceRange(torrent, other)
    deselectRange(torrent, range.start, range.end, 0)
    deselectRange(torrent, range.start, range.end, 1)
  }

  file.select(1)

  const { start, end } = pieceRange(torrent, file)
  const span = end - start + 1
  const headCount = Math.max(1, Math.ceil(span * 0.05))
  const tailCount = Math.max(1, Math.ceil(span * 0.01))
  const headEnd = Math.min(end, start + headCount - 1)
  const tailStart = Math.max(start, end - tailCount + 1)
  // Older webtorrent builds may not expose critical().
  if (typeof torrent.critical === 'function') {
    torrent.critical(start, headEnd)
    torrent.critical(tailStart, end)
  }
}

class DirectServer {
  constructor() {
    this.servers = new Map()
  }

  ensure(torrent) {
    const existing = this.servers.get(torrent.infoHash)
    if (existing) return Promise.resolve(existing.port)

    const server = torrent.createServer({
      origin: '*',
      hostname: '127.0.0.1',
    })

    return new Promise((resolve, reject) => {
      const onError = (error) => {
        server.removeListener('error', onError)
        reject(error)
      }
      server.once('error', onError)
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', onError)
        const address = server.address()
        const port = address && address.port
        if (!port) {
          reject(new Error('Could not bind the local stream.'))
          return
        }
        this.servers.set(torrent.infoHash, { server, port })
        resolve(port)
      })
    })
  }

  close(infoHash) {
    const entry = this.servers.get(infoHash)
    if (!entry) return
    this.servers.delete(infoHash)
    const done = () => {}
    if (typeof entry.server.destroy === 'function') entry.server.destroy(done)
    else entry.server.close(done)
  }

  closeAll() {
    for (const infoHash of [...this.servers.keys()]) this.close(infoHash)
  }
}

function directStreamUrl(port, fileIndex) {
  return `http://127.0.0.1:${port}/${fileIndex}`
}

module.exports = {
  VIDEO_EXTENSIONS,
  chooseVideoFiles,
  prioritizePlayback,
  DirectServer,
  directStreamUrl,
  extensionOf,
}
