const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { app, BrowserWindow, dialog, ipcMain, Menu, screen } = require('electron')
const logger = require('./logger')
const { lookupMovie, parseTitleYear } = require('./metadata')
const { createStore } = require('./store')
const { TorrentManager } = require('./torrentManager')
const { MIN_HEIGHT, MIN_WIDTH, resolveWindowBounds } = require('./windowState')

const DEV_SERVER = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:5173'
const CRASH_WINDOW_MS = 60000
const CRASH_RELOAD_LIMIT = 3

let mainWindow = null
let libraryStore = null
let manager = null
let quitting = false
let userClosing = false
let pendingFocus = false
const crashReloads = []
let crashDialogShown = false

function loadEnvFile() {
  const candidates = [path.join(process.cwd(), '.env')]
  try {
    candidates.push(path.join(app.getAppPath(), '.env'))
  } catch (error) {
    logger.error('env path failed', error)
  }
  try {
    candidates.push(path.join(app.getPath('userData'), '.env'))
  } catch (error) {
    logger.error('env path failed', error)
  }
  try {
    candidates.push(path.join(path.dirname(process.execPath), '.env'))
  } catch (error) {
    logger.error('env path failed', error)
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, '.env'))
  }
  for (const file of candidates) {
    let text = ''
    try {
      if (!file || !fs.existsSync(file)) continue
      text = fs.readFileSync(file, 'utf8')
    } catch (error) {
      logger.error('env read failed', file, error)
      continue
    }
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

function importTmdbKey() {
  const fromEnv = String(process.env.TMDB_API_KEY || '').trim()
  if (!fromEnv) return
  const settings = libraryStore.getSettings() || {}
  const stored = String(settings.tmdbApiKey || '').trim()
  if (stored) return
  libraryStore.updateSettings({ tmdbApiKey: fromEnv })
  logger.info('Imported TMDB API key into settings')
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
  const currentTime = Number(payload.currentTime)
  if (!Number.isFinite(currentTime)) return null
  return libraryStore.saveProgress(
    payload.infoHash,
    Number(payload.fileIndex),
    currentTime,
    Number(payload.duration),
  )
}

function workAreas() {
  try {
    return screen.getAllDisplays().map((display) => display.workArea)
  } catch (error) {
    logger.error('display lookup failed', error)
    return []
  }
}

function persistWindowState() {
  if (!libraryStore || !mainWindow || mainWindow.isDestroyed()) return
  try {
    const normal = mainWindow.getNormalBounds()
    libraryStore.saveWindowState({
      x: normal.x,
      y: normal.y,
      width: normal.width,
      height: normal.height,
      maximized: mainWindow.isMaximized(),
    })
  } catch (error) {
    logger.error('window state save failed', error)
  }
}

function allowCrashReload(now = Date.now()) {
  while (crashReloads.length && now - crashReloads[0] > CRASH_WINDOW_MS) crashReloads.shift()
  if (crashReloads.length >= CRASH_RELOAD_LIMIT) return false
  crashReloads.push(now)
  return true
}

function onRendererGone(event, details) {
  const reason = details && details.reason
  const exitCode = details && details.exitCode
  logger.error('render-process-gone', reason, exitCode)
  if (reason === 'clean-exit' || quitting || userClosing) return
  const contents = event && event.sender
  if (!contents || contents.isDestroyed()) return
  if (!allowCrashReload()) {
    if (crashDialogShown) return
    crashDialogShown = true
    dialog.showErrorBox(
      'Lumen',
      `The window crashed repeatedly (${reason || 'unknown'}).\n\nLog: ${logger.logPath()}`,
    )
    return
  }
  crashDialogShown = false
  try {
    contents.reload()
  } catch (error) {
    logger.error('reload failed', error)
  }
}

function allowNavigation(target) {
  if (!app.isPackaged) {
    try {
      const devOrigin = new URL(DEV_SERVER).origin
      if (target.startsWith(devOrigin)) return true
    } catch (error) {
      logger.error('dev origin failed', error)
    }
    return target.startsWith('file://')
  }
  try {
    const allowed = pathToFileURL(path.resolve(__dirname, '../dist/index.html')).href
    if (process.platform === 'win32') return target.toLowerCase() === allowed.toLowerCase()
    return target === allowed
  } catch (error) {
    logger.error('navigation check failed', error)
    return false
  }
}

function blockPackagedShortcuts() {
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!app.isPackaged || input.type !== 'keyDown') return
    const key = String(input.key || '').toLowerCase()
    const accel = input.control || input.meta
    const reload = key === 'f5' || (accel && key === 'r')
    const devtools = key === 'f12' || (accel && input.shift && key === 'i')
    if (reload || devtools) event.preventDefault()
  })
}

function createWindow() {
  crashReloads.length = 0
  crashDialogShown = false
  userClosing = false
  const saved = libraryStore.getWindowState()
  const bounds = resolveWindowBounds(saved, workAreas())
  const options = {
    width: bounds.width,
    height: bounds.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: '#11131c',
    autoHideMenuBar: true,
    title: 'Lumen',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  }
  if (!app.isPackaged) options.icon = path.join(__dirname, '../build/icon.ico')
  if (Number.isFinite(bounds.x) && Number.isFinite(bounds.y)) {
    options.x = bounds.x
    options.y = bounds.y
  }
  mainWindow = new BrowserWindow(options)
  if (bounds.maximized) mainWindow.maximize()
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.show()
    if (!pendingFocus) return
    pendingFocus = false
    mainWindow.focus()
  })
  mainWindow.on('close', () => {
    userClosing = true
    persistWindowState()
  })
  mainWindow.on('unresponsive', () => {
    logger.warn('window unresponsive')
  })
  mainWindow.on('responsive', () => {
    logger.info('window responsive')
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (allowNavigation(url)) return
    event.preventDefault()
    logger.warn('blocked navigation', url)
  })
  mainWindow.webContents.on('render-process-gone', onRendererGone)
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame) return
    logger.error('did-fail-load', code, description, url)
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return
    mainWindow.show()
  })
  blockPackagedShortcuts()

  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (event) => {
      if (event.level >= 2) logger.info(`[renderer] ${event.message}`)
    })
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents
        .executeJavaScript(
          'Boolean(window.api && typeof window.api.addTorrent === "function" && typeof window.api.selectFile === "function")',
        )
        .then((ready) => {
          logger.info(`[lumen] preload bridge ${ready ? 'ready' : 'missing'}`)
        })
        .catch((error) => logger.error('[lumen] bridge check failed', error))
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

function failStartup(error) {
  logger.error('startup failed', error)
  const message = error instanceof Error ? error.stack || error.message : String(error)
  try {
    dialog.showErrorBox('Lumen could not start', `${message}\n\nLog: ${logger.logPath()}`)
  } catch (dialogError) {
    logger.error('error dialog failed', dialogError)
  }
  logger.flush()
  app.exit(1)
}

function boot() {
  logger.attach(app)
  if (app.isPackaged) Menu.setApplicationMenu(null)
  loadEnvFile()
  const defaultCache = path.join(app.getPath('userData'), 'torrent-cache')
  fs.mkdirSync(defaultCache, { recursive: true })
  libraryStore = createStore(defaultCache)
  importTmdbKey()
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
  logger.info('Lumen started')
}

function focusExisting() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingFocus = true
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function bindSingleInstance() {
  app.on('second-instance', focusExisting)

  app.whenReady()
    .then(() => {
      boot()
    })
    .catch((error) => {
      failStartup(error)
    })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    persistWindowState()
    const force = setTimeout(() => {
      logger.flush()
      app.exit(0)
    }, 8000)
    shutdown()
      .catch((error) => {
        logger.error('shutdown failed', error)
      })
      .finally(() => {
        clearTimeout(force)
        logger.flush()
        app.exit(0)
      })
  })
}

if (process.platform === 'win32') app.setAppUserModelId('com.lumen.player')

process.on('uncaughtException', (error) => {
  logger.error('uncaughtException', error)
})

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', reason)
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  bindSingleInstance()
}
