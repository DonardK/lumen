const fs = require('fs')
const path = require('path')
const WebTorrent = require('webtorrent')
const {
  DirectServer,
  chooseVideoFiles,
  directStreamUrl,
  prioritizePlayback,
} = require('./streamServer')
const { TranscodeServer, probeFile } = require('./transcodeServer')

const MAGNET_PATTERN = /^magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}/
const NO_PEERS =
  'No peers found after 20 seconds. This torrent may be dead, or the network is blocking DHT.'
const NO_VIDEO = 'This torrent does not contain a playable video file.'
const INVALID_LINK =
  'That does not look like a magnet link. Paste a magnet:?xt=urn:btih:… link, a .torrent URL, or drop a .torrent file.'

function appError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function classifyInput(input) {
  const value = String(input || '').trim()
  if (!value || value.length > 8000) {
    return { error: appError('invalid-magnet', INVALID_LINK) }
  }
  if (/^magnet:/i.test(value)) {
    if (!MAGNET_PATTERN.test(value)) {
      return { error: appError('invalid-magnet', INVALID_LINK) }
    }
    return { value }
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { error: appError('invalid-magnet', INVALID_LINK) }
      }
      return { value: url.toString() }
    } catch {
      return { error: appError('invalid-magnet', INVALID_LINK) }
    }
  }
  if (
    path.isAbsolute(value) &&
    value.toLowerCase().endsWith('.torrent') &&
    fs.existsSync(value) &&
    fs.statSync(value).isFile()
  ) {
    return { value }
  }
  return { error: appError('invalid-magnet', INVALID_LINK) }
}

function cacheFolder(torrent) {
  return path.join(torrent.path, `${torrent.name} - ${torrent.infoHash.slice(0, 8)}`)
}

class TorrentManager {
  constructor({ getCacheDir, send }) {
    this.getCacheDir = getCacheDir
    this.send = send
    this.client = new WebTorrent({
      dht: true,
      utp: false,
      webSeeds: true,
    })
    this.client.on('error', (error) => {
      console.error('[webtorrent]', error)
    })
    this.direct = new DirectServer()
    this.transcode = new TranscodeServer({
      onError: (infoHash, message) => {
        this.send('torrent:error', {
          infoHash,
          error: { code: 'ffmpeg', message },
        })
      },
    })
    this.activeFile = new Map()
    this.addedAt = new Map()
    this.peerWarned = new Set()
    this.statsTimer = setInterval(() => this._broadcastStats(), 1000)
  }

  add(input) {
    const classified = classifyInput(input)
    if (classified.error) return Promise.reject(classified.error)

    const existing = this._existing(classified.value)
    if (existing) return this._whenReady(existing)

    return new Promise((resolve, reject) => {
      let settled = false
      let peerTimer
      let metadataTimer
      const finish = (error, value) => {
        if (settled) return
        settled = true
        clearTimeout(peerTimer)
        clearTimeout(metadataTimer)
        if (error) reject(error)
        else resolve(value)
      }

      let torrent
      try {
        torrent = this.client.add(
          classified.value,
          { path: this.getCacheDir(), addUID: true },
          (readyTorrent) => {
            this._whenReady(readyTorrent).then(
              (summary) => finish(null, summary),
              (error) => finish(error),
            )
          },
        )
      } catch (error) {
        finish(this._normalizeError(error))
        return
      }

      if (torrent.infoHash) this.addedAt.set(torrent.infoHash, Date.now())
      torrent.once('error', (error) => {
        if (/duplicate torrent/i.test(String(error?.message))) return
        finish(this._normalizeError(error))
      })

      peerTimer = setTimeout(() => {
        if (torrent.ready || torrent.done || torrent.numPeers > 0) return
        finish(appError('no-peers', NO_PEERS))
      }, 20000)

      metadataTimer = setTimeout(() => {
        if (torrent.ready || torrent.done) return
        finish(appError('no-peers', NO_PEERS))
      }, 60000)
    })
  }

  _whenReady(torrent) {
    if (torrent.ready) {
      try {
        return Promise.resolve(this._summary(torrent))
      } catch (error) {
        return Promise.reject(error)
      }
    }
    return new Promise((resolve, reject) => {
      const onReady = () => {
        torrent.removeListener('error', onError)
        try {
          resolve(this._summary(torrent))
        } catch (error) {
          reject(error)
        }
      }
      const onError = (error) => {
        torrent.removeListener('ready', onReady)
        reject(this._normalizeError(error))
      }
      torrent.once('ready', onReady)
      torrent.once('error', onError)
    })
  }

  async selectFile(infoHash, fileIndex) {
    const torrent = this.client.get(infoHash)
    if (!torrent?.ready) {
      throw appError('unknown', 'That torrent is not loaded yet.')
    }
    const file = torrent.files[fileIndex]
    if (!file) throw appError('no-playable-file', NO_VIDEO)

    this._focus(torrent)
    prioritizePlayback(torrent, file)
    const probe = await probeFile(file, torrent)
    prioritizePlayback(torrent, file)
    this.activeFile.set(torrent.infoHash, file)

    const duration = probe.duration
    if (probe.mode === 'direct') {
      const port = await this.direct.ensure(torrent)
      return {
        mode: 'direct',
        streamUrl: directStreamUrl(port, fileIndex),
        duration,
      }
    }

    const port = await this.transcode.ensure()
    this.transcode.register(torrent.infoHash, fileIndex, { file, probe })
    return {
      mode: 'transcode',
      streamUrl: this.transcode.streamUrl(torrent.infoHash, fileIndex),
      duration,
    }
  }

  remove(infoHash, { deleteFiles }) {
    this.direct.close(infoHash)
    this.transcode.unregister(infoHash)
    this.activeFile.delete(infoHash)
    this.peerWarned.delete(infoHash)
    const torrent = this.client.get(infoHash)
    if (!torrent) return Promise.resolve()
    return new Promise((resolve) => {
      this.client.remove(infoHash, { destroyStore: Boolean(deleteFiles) }, () => resolve())
    })
  }

  has(infoHash) {
    return Boolean(this.client.get(infoHash))
  }

  shutdown({ library, keepCache }) {
    clearInterval(this.statsTimer)
    this.transcode.killAll()
    this.direct.closeAll()
    const torrents = [...this.client.torrents]
    return new Promise((resolve) => {
      const destroyClient = () => {
        try {
          this.client.destroy(() => resolve())
        } catch {
          resolve()
        }
      }
      if (torrents.length === 0) {
        destroyClient()
        return
      }
      let pending = torrents.length
      for (const torrent of torrents) {
        const saved = Boolean(library[torrent.infoHash])
        const deleteFiles = !(saved && keepCache)
        try {
          this.client.remove(torrent.infoHash, { destroyStore: deleteFiles }, () => {
            pending -= 1
            if (pending === 0) destroyClient()
          })
        } catch {
          pending -= 1
          if (pending === 0) destroyClient()
        }
      }
    })
  }

  _existing(id) {
    try {
      return this.client.get(id)
    } catch {
      return null
    }
  }

  _summary(torrent) {
    if (!this.addedAt.has(torrent.infoHash)) this.addedAt.set(torrent.infoHash, Date.now())
    const chosen = chooseVideoFiles(torrent)
    return {
      infoHash: torrent.infoHash,
      name: torrent.name,
      magnetURI: torrent.magnetURI,
      cachePath: cacheFolder(torrent),
      ...chosen,
    }
  }

  _focus(torrent) {
    for (const other of this.client.torrents) {
      if (other.infoHash !== torrent.infoHash) {
        this._pause(other)
        continue
      }
      other.resume()
      // _pause deselects every piece to priority 0 and resume() does not
      // re-select them, so a paused-then-resumed torrent could sit idle with
      // no selection until playback runs prioritizePlayback. Re-select the
      // whole torrent at normal priority; prioritizePlayback narrows it again.
      if (torrent.pieces.length > 0) {
        try {
          torrent.select(0, torrent.pieces.length - 1, 0)
        } catch {
          // Selection failures here are non-fatal; playback re-selects below.
        }
      }
    }
  }

  _pause(torrent) {
    const last = torrent.pieces.length - 1
    if (last >= 0) {
      try {
        torrent.deselect(0, last, 0)
      } catch {
        // Already idle.
      }
    }
    for (const wire of [...(torrent.wires || [])]) {
      try {
        wire.destroy()
      } catch {
        // Peer already left.
      }
    }
    torrent.pause()
  }

  _broadcastStats() {
    const now = Date.now()
    for (const torrent of this.client.torrents) {
      const file = this.activeFile.get(torrent.infoHash)
      const progress = file ? file.progress : torrent.progress
      const downloaded = file ? file.downloaded : torrent.downloaded
      const total = file ? file.length : torrent.length || 0
      this.send('torrent:stats', {
        infoHash: torrent.infoHash,
        downloadSpeed: torrent.downloadSpeed,
        numPeers: torrent.numPeers,
        progress,
        downloaded,
        total,
        paused: Boolean(torrent.paused),
      })

      const started = this.addedAt.get(torrent.infoHash) || now
      const noData = downloaded === 0 && !torrent.done && progress < 1
      if (
        noData &&
        torrent.numPeers === 0 &&
        now - started >= 20000 &&
        !this.peerWarned.has(torrent.infoHash)
      ) {
        this.peerWarned.add(torrent.infoHash)
        this.send('torrent:error', {
          infoHash: torrent.infoHash,
          error: { code: 'no-peers', message: NO_PEERS },
        })
      }
    }
  }

  _normalizeError(error) {
    if (error?.code) return error
    const message = String(error?.message || error || 'Could not add that torrent.')
    if (/no peers|timed out/i.test(message)) return appError('no-peers', NO_PEERS)
    if (/invalid|magnet|parse/i.test(message)) return appError('invalid-magnet', INVALID_LINK)
    return appError('unknown', message)
  }
}

module.exports = {
  TorrentManager,
  classifyInput,
  MAGNET_PATTERN,
}
