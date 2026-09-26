const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { PassThrough } = require('stream')

const SAMPLE_BYTES = 8 * 1024 * 1024

function appError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function binaryPath(packageName) {
  let raw
  try {
    raw = require(packageName)
  } catch {
    return ''
  }
  const candidate = typeof raw === 'string' ? raw : raw && raw.path
  if (typeof candidate !== 'string' || !candidate) return ''
  const unpacked = candidate.includes('app.asar')
    ? candidate.replace('app.asar', 'app.asar.unpacked')
    : candidate
  if (fs.existsSync(unpacked)) return unpacked
  if (fs.existsSync(candidate)) return candidate
  return ''
}

let ffmpeg = null

function getFfmpeg() {
  if (ffmpeg) return ffmpeg
  ffmpeg = require('fluent-ffmpeg')
  const ffmpegBin = binaryPath('ffmpeg-static')
  const ffprobeBin = binaryPath('ffprobe-static')
  if (!ffmpegBin) {
    throw appError(
      'ffmpeg',
      'Could not optimize this file for playback. ffmpeg was not found.',
    )
  }
  ffmpeg.setFfmpegPath(ffmpegBin)
  if (ffprobeBin) ffmpeg.setFfprobePath(ffprobeBin)
  return ffmpeg
}

function asNodeStream(fileStream) {
  const pass = new PassThrough()
  const resume = () => {
    if (typeof fileStream.resume === 'function') fileStream.resume()
  }
  fileStream.on('data', (chunk) => {
    if (!pass.write(chunk)) {
      if (typeof fileStream.pause === 'function') fileStream.pause()
    }
  })
  fileStream.on('end', () => pass.end())
  fileStream.on('error', (error) => pass.destroy(error))
  pass.on('drain', resume)
  const closeSource = () => {
    if (typeof fileStream.destroy === 'function') fileStream.destroy()
  }
  pass.on('close', closeSource)
  resume()
  return pass
}

function readSample(file, torrent) {
  const end = Math.min(file.length - 1, SAMPLE_BYTES - 1)
  if (end < 0) {
    return Promise.reject(
      appError('no-playable-file', 'This torrent does not contain a playable video file.'),
    )
  }

  const tmp = path.join(
    os.tmpdir(),
    `lumen-probe-${torrent.infoHash}-${Date.now()}.bin`,
  )
  const output = fs.createWriteStream(tmp)
  const input = asNodeStream(file.createReadStream({ start: 0, end }))

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(peerTimer)
      clearTimeout(maxTimer)
      if (error) {
        input.destroy()
        output.destroy()
        fs.rm(tmp, { force: true }, () => {})
        reject(error)
        return
      }
      resolve(value)
    }

    const peerTimer = setTimeout(() => {
      if (torrent.numPeers === 0 && file.downloaded === 0 && !torrent.done) {
        finish(
          appError(
            'no-peers',
            'No peers found after 20 seconds. This torrent may be dead, or the network is blocking DHT.',
          ),
        )
      }
    }, 20000)

    const maxTimer = setTimeout(() => {
      finish(
        appError(
          'no-peers',
          'No peers found after 20 seconds. This torrent may be dead, or the network is blocking DHT.',
        ),
      )
    }, 45000)

    input.on('error', (error) => finish(error))
    output.on('error', (error) => finish(error))
    output.on('finish', () => finish(null, tmp))
    input.pipe(output)
  })
}

function classify(data, filename) {
  const formatName = String(data?.format?.format_name || '').toLowerCase()
  const streams = Array.isArray(data?.streams) ? data.streams : []
  const video = streams.find((stream) => stream.codec_type === 'video')
  const audio = streams.find((stream) => stream.codec_type === 'audio')
  const videoCodec = String(video?.codec_name || '').toLowerCase()
  const audioCodec = String(audio?.codec_name || '').toLowerCase()
  const ext = path.extname(filename).toLowerCase()
  const duration = Number(data?.format?.duration)
  const isWebm = ext === '.webm' && formatName.includes('webm')
  const isMp4 =
    (ext === '.mp4' || ext === '.m4v') &&
    (formatName.includes('mp4') || formatName.includes('mov'))
  const videoOk =
    (isWebm && (videoCodec === 'vp8' || videoCodec === 'vp9')) ||
    (isMp4 && videoCodec === 'h264')
  const audioOk =
    !audio ||
    (isWebm && (audioCodec === 'opus' || audioCodec === 'vorbis')) ||
    (isMp4 && audioCodec === 'aac')

  return {
    mode: videoOk && audioOk ? 'direct' : 'transcode',
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    videoCodec,
    audioCodec,
    height: Number(video?.height) || 0,
    copyVideo: videoCodec === 'h264',
    copyAudio: !audio || audioCodec === 'aac',
  }
}

function probeWithFfprobe(samplePath) {
  const command = getFfmpeg()
  return new Promise((resolve, reject) => {
    command.ffprobe(samplePath, (error, data) => {
      if (error) reject(error)
      else resolve(data)
    })
  })
}

async function probeFile(file, torrent) {
  const sample = await readSample(file, torrent)
  try {
    const data = await probeWithFfprobe(sample)
    return classify(data, file.name || file.path || '')
  } catch (error) {
    console.error('[probe] ffprobe failed, using transcode', error)
    return {
      mode: 'transcode',
      duration: null,
      videoCodec: '',
      audioCodec: '',
      height: 0,
      copyVideo: false,
      copyAudio: false,
    }
  } finally {
    fs.rm(sample, { force: true }, () => {})
  }
}

function isLocalAddress(address) {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  )
}

function ignoredFfmpegError(error) {
  const message = String(error?.message || error || '')
  return /killed|sigkill|sigint|output stream closed|premature close|ffmpeg was killed/i.test(
    message,
  )
}

class TranscodeServer {
  constructor({ onError } = {}) {
    this.onError = onError || (() => {})
    this.server = null
    this.port = 0
    this.starting = null
    this.jobs = new Map()
    this.commands = new Map()
  }

  ensure() {
    if (this.port) return Promise.resolve(this.port)
    if (this.starting) return this.starting
    this.starting = new Promise((resolve, reject) => {
      this.server = http.createServer((request, response) => {
        this._handle(request, response)
      })
      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        this.server.removeListener('error', reject)
        // Keep a listener attached so a late socket error can never crash the app.
        this.server.on('error', (error) => console.error('[transcode]', error))
        const address = this.server.address()
        this.port = address.port
        resolve(this.port)
      })
    })
    return this.starting
  }

  register(infoHash, fileIndex, job) {
    this.jobs.set(`${infoHash}:${fileIndex}`, job)
  }

  unregister(infoHash) {
    for (const key of [...this.jobs.keys()]) {
      if (key.startsWith(`${infoHash}:`)) {
        this._stop(key)
        this.jobs.delete(key)
      }
    }
  }

  streamUrl(infoHash, fileIndex) {
    const params = new URLSearchParams({
      infoHash,
      file: String(fileIndex),
      t: '0',
    })
    return `http://127.0.0.1:${this.port}/stream?${params.toString()}`
  }

  killAll() {
    for (const key of [...this.commands.keys()]) this._stop(key)
    if (this.server) {
      this.server.close()
      this.server = null
      this.port = 0
      this.starting = null
    }
  }

  _stop(key) {
    const command = this.commands.get(key)
    if (!command) return
    this.commands.delete(key)
    try {
      command.kill('SIGKILL')
    } catch {
      // The process already exited.
    }
  }

  _handle(request, response) {
    if (!isLocalAddress(request.socket.remoteAddress)) {
      response.writeHead(403)
      response.end()
      return
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1')
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      })
      response.end()
      return
    }

    if (url.pathname !== '/stream') {
      response.writeHead(404)
      response.end()
      return
    }

    const infoHash = url.searchParams.get('infoHash') || ''
    const fileIndex = Number(url.searchParams.get('file'))
    const seek = Math.max(0, Number(url.searchParams.get('t')) || 0)
    const job = this.jobs.get(`${infoHash}:${fileIndex}`)
    if (!job) {
      response.writeHead(404)
      response.end()
      return
    }

    if (request.method === 'HEAD') {
      response.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      })
      response.end()
      return
    }

    if (request.method !== 'GET') {
      response.writeHead(405)
      response.end()
      return
    }

    const key = `${infoHash}:${fileIndex}`
    this._stop(key)

    let command
    try {
      command = this._spawn(job, seek, response, infoHash)
    } catch (error) {
      this.onError(infoHash, error.message)
      if (!response.headersSent) {
        response.writeHead(500)
        response.end(error.message)
      }
      return
    }

    this.commands.set(key, command)
    const clear = () => {
      if (this.commands.get(key) === command) this.commands.delete(key)
    }
    request.on('close', () => {
      this._stop(key)
      clear()
    })
    command.on('end', clear)
  }

  _spawn(job, seek, response, infoHash) {
    const ffmpegCommand = getFfmpeg()
    const source = asNodeStream(job.file.createReadStream())
    const command = ffmpegCommand(source).inputOptions([
      '-analyzeduration',
      '10000000',
      '-probesize',
      '10000000',
    ])

    if (seek > 0) command.seekInput(seek)

    command.format('mp4').outputOptions([
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      '-frag_duration',
      '500000',
      '-max_muxing_queue_size',
      '1024',
    ])

    if (job.probe.copyVideo) {
      command.videoCodec('copy')
    } else {
      command.videoCodec('libx264').outputOptions([
        '-preset',
        'veryfast',
        '-tune',
        'zerolatency',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-g',
        '48',
      ])
      if (job.probe.height > 1080) command.videoFilters('scale=-2:1080')
    }

    if (!job.probe.audioCodec) command.noAudio()
    else if (job.probe.copyAudio) command.audioCodec('copy')
    else command.audioCodec('aac').audioBitrate('160k').outputOptions(['-ac', '2'])

    command.on('error', (error) => {
      if (ignoredFfmpegError(error)) return
      console.error('[ffmpeg]', error)
      this.onError(
        infoHash,
        'Could not optimize this file for playback. The transcoder failed before the video could start.',
      )
      if (!response.writableEnded) response.destroy()
    })

    response.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    })
    command.pipe(response, { end: true })
    return command
  }
}

module.exports = {
  TranscodeServer,
  probeFile,
}
