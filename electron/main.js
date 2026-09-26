const fs = require('fs')
const path = require('path')
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { lookupMovie, parseTitleYear } = require('./metadata')
const { createStore } = require('./store')
const { TorrentManager } = require('./torrentManager')

const DEV_SERVER = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:5173'

let mainWindow = null
let libraryStore = null
let manager = null
let quitting = false

function loadEnvFile() {
  const candidates = [path.join(process.cwd(), '.env'), path.join(app.getAppPath(), '.env')]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  }
}

function cacheDir() {
  const configured = libraryStore.getSettings().cacheDir
  const dir = configured || path.join(app.getPath('userData'), 'torrent-cache')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function tmdbKey() {
  return process.env.TMDB_API_KEY || libraryStore.getSettings().tmdbApiKey || ''
}

function isInside(parent, target) {
  if (!parent || !target) return false
  const relative = path.relative(path.resolve(parent), path.resolve(target))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function send(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

function toResult(promise) {
  return promise.then(
    (data) => ({ ok: true, ...data }),
    (error) => ({
      ok: false,
      error: {
        code: error.code || 'unknown',
        message: error.message || 'Something went wrong.',
      },
    }),
  )
}

async function buildEntry(summary) {
  const parsed = parseTitleYear(summary.name)
  const meta = await lookupMovie(parsed.title, parsed.year, tmdbKey())
  const previous = libraryStore.getLibrary()[summary.infoHash] || {}
  return {
    magnetURI: summary.magnetURI || previous.magnetURI,
    title: meta?.title || parsed.title || summary.name,
    year: meta?.year || parsed.year || previous.year || 0,
    posterUrl: meta?.posterUrl || previous.posterUrl || '',
    tmdbId: meta?.tmdbId || previous.tmdbId || null,
    fileIndex: previous.fileIndex ?? summary.suggestedFileIndex,
    progressSeconds: previous.progressSeconds || 0,
    durationSeconds: previous.durationSeconds || meta?.runtimeMinutes * 60 || 0,
    addedAt: previous.addedAt || new Date().toISOString(),
    lastWatchedAt: previous.lastWatchedAt || new Date().toISOString(),
    cachePath: summary.cachePath,
    overview: meta?.overview || previous.overview || '',
    genre: meta?.genre || previous.genre || '',
    director: meta?.director || previous.director || '',
    tags: meta?.tags || previous.tags || ['live-action'],
  }
}

function registerIpc() {
  ipcMain.handle('torrent:add', (_event, input) =>
    toResult(
      (async () => {
        const summary = await manager.add(input)
        const resumed = Boolean(libraryStore.getLibrary()[summary.infoHash])
        const entry = await buildEntry(summary)
        libraryStore.upsert(summary.infoHash, entry)
        return { ...summary, entry, resumed }
      })(),
    ),
  )

  ipcMain.handle('torrent:select-file', (_event, infoHash, fileIndex) =>
    toResult(manager.selectFile(infoHash, Number(fileIndex))),
  )

  ipcMain.handle('torrent:remove', (_event, infoHash) =>
    toResult(
      (async () => {
        const hash = String(infoHash || '').toLowerCase()
        const saved = Boolean(libraryStore.getLibrary()[hash])
        const keep = libraryStore.getSettings().keepCacheOnClose !== false
        await manager.remove(hash, { deleteFiles: !(saved && keep) })
        return {}
      })(),
    ),
  )

  ipcMain.handle('torrent:pick-file', async () => {
    const parent = BrowserWindow.getFocusedWindow() || mainWindow
    const result = await dialog.showOpenDialog(parent, {
      title: 'Open torrent',
      properties: ['openFile'],
      filters: [{ name: 'Torrent', extensions: ['torrent'] }],
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true }
    return { ok: true, path: result.filePaths[0] }
  })

  ipcMain.handle('settings:pick-dir', async () => {
    const parent = BrowserWindow.getFocusedWindow() || mainWindow
    const result = await dialog.showOpenDialog(parent, {
      title: 'Choose a cache folder',
      defaultPath: cacheDir(),
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true }
    return { ok: true, path: result.filePaths[0] }
  })

  ipcMain.handle('library:get', () => libraryStore.getLibrary())

  ipcMain.handle('library:upsert', (_event, payload) => {
    try {
      const { infoHash, ...fields } = payload || {}
      if (fields.cachePath && !isInside(cacheDir(), fields.cachePath)) delete fields.cachePath
      const entry = libraryStore.upsert(infoHash, fields)
      return { ok: true, entry }
    } catch (error) {
      return {
        ok: false,
        error: { code: error.code || 'unknown', message: error.message },
      }
    }
  })

  ipcMain.handle('library:remove-entry', (_event, infoHash) => {
    const hash = String(infoHash || '').toLowerCase()
    const removed = libraryStore.remove(hash)
    if (removed?.cachePath && !manager.has(hash) && isInside(cacheDir(), removed.cachePath)) {
      fs.rmSync(removed.cachePath, { recursive: true, force: true })
    }
    return { ok: true }
  })

  ipcMain.handle('watchlist:get', () => libraryStore.getWatchlist())
  ipcMain.handle('watchlist:toggle', (_event, infoHash) => libraryStore.toggleWatchlist(infoHash))
  ipcMain.handle('settings:get', () => libraryStore.getSettings())
  ipcMain.handle('settings:set', (_event, partial) => {
    const next = libraryStore.updateSettings(partial || {})
    if (next.cacheDir) fs.mkdirSync(next.cacheDir, { recursive: true })
    return next
  })

  ipcMain.handle('progress:save', (_event, payload) => {
    saveProgress(payload)
  })

  ipcMain.on('progress:flush', (_event, payload) => {
    saveProgress(payload)
  })
}

function saveProgress(payload) {
  if (!payload) return null
  return libraryStore.saveProgress(
    payload.infoHash,
    Number(payload.fileIndex),
    Number(payload.currentTime),
    Number(payload.duration),
  )
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 880,
    minHeight: 640,
    backgroundColor: '#11131c',
    autoHideMenuBar: true,
    title: 'Lumen',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devOrigin = new URL(DEV_SERVER).origin
    if (!app.isPackaged && url.startsWith(devOrigin)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
  })

  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (event) => {
      if (event.level >= 2) console.log(`[renderer] ${event.message}`)
    })
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents
        .executeJavaScript(
          'Boolean(window.api && typeof window.api.addTorrent === "function" && typeof window.api.selectFile === "function")',
        )
        .then((ready) => {
          console.log(`[lumen] preload bridge ${ready ? 'ready' : 'missing'}`)
        })
        .catch((error) => console.error('[lumen] bridge check failed', error))
    })
    mainWindow.loadURL(DEV_SERVER)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

async function shutdown() {
  const library = libraryStore ? libraryStore.getLibrary() : {}
  const keepCache = libraryStore ? libraryStore.getSettings().keepCacheOnClose !== false : true
  if (manager) await manager.shutdown({ library, keepCache })
}

app.whenReady().then(() => {
  loadEnvFile()
  const defaultCache = path.join(app.getPath('userData'), 'torrent-cache')
  fs.mkdirSync(defaultCache, { recursive: true })
  libraryStore = createStore(defaultCache)
  fs.mkdirSync(cacheDir(), { recursive: true })
  manager = new TorrentManager({
    getCacheDir: cacheDir,
    send,
  })
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  const force = setTimeout(() => app.exit(0), 8000)
  shutdown().finally(() => {
    clearTimeout(force)
    app.exit(0)
  })
})
