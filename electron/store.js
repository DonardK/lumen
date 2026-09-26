const Store = require('electron-store')

const LIBRARY_FIELDS = [
  'magnetURI',
  'title',
  'year',
  'posterUrl',
  'tmdbId',
  'fileIndex',
  'progressSeconds',
  'durationSeconds',
  'addedAt',
  'lastWatchedAt',
  'cachePath',
  'overview',
  'genre',
  'director',
  'tags',
]

function isHexHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
}

function createStore(defaultCacheDir) {
  const store = new Store({
    name: 'lumen',
    defaults: {
      library: {},
      watchlist: [],
      settings: {
        cacheDir: defaultCacheDir,
        keepCacheOnClose: true,
        tmdbApiKey: '',
      },
    },
  })

  return {
    getLibrary() {
      return store.get('library') || {}
    },

    getSettings() {
      return store.get('settings')
    },

    getWatchlist() {
      return store.get('watchlist') || []
    },

    upsert(infoHash, fields) {
      const hash = String(infoHash || '').toLowerCase()
      if (!isHexHash(hash)) {
        const error = new Error('Invalid info hash.')
        error.code = 'unknown'
        throw error
      }
      const library = store.get('library') || {}
      const previous = library[hash] || {}
      const next = { ...previous }
      for (const key of LIBRARY_FIELDS) {
        if (fields[key] !== undefined) next[key] = fields[key]
      }
      if (!next.magnetURI) {
        const error = new Error('A library entry needs a magnet link.')
        error.code = 'invalid-magnet'
        throw error
      }
      if (!next.addedAt) next.addedAt = new Date().toISOString()
      if (typeof next.progressSeconds === 'number') {
        next.progressSeconds = Math.max(0, next.progressSeconds)
      }
      if (typeof next.durationSeconds === 'number') {
        next.durationSeconds = Math.max(0, next.durationSeconds)
      }
      library[hash] = next
      store.set('library', library)
      return next
    },

    remove(infoHash) {
      const hash = String(infoHash || '').toLowerCase()
      const library = store.get('library') || {}
      const removed = library[hash] || null
      if (!removed) return null
      delete library[hash]
      store.set('library', library)
      const watchlist = (store.get('watchlist') || []).filter((id) => id !== hash)
      store.set('watchlist', watchlist)
      return removed
    },

    saveProgress(infoHash, fileIndex, currentTime, duration) {
      const hash = String(infoHash || '').toLowerCase()
      const library = store.get('library') || {}
      const entry = library[hash]
      if (!entry) return null
      entry.fileIndex = Number.isInteger(fileIndex) ? fileIndex : entry.fileIndex
      entry.progressSeconds = Math.max(0, Number(currentTime) || 0)
      if (Number(duration) > 0) entry.durationSeconds = Number(duration)
      entry.lastWatchedAt = new Date().toISOString()
      library[hash] = entry
      store.set('library', library)
      return entry
    },

    toggleWatchlist(infoHash) {
      const hash = String(infoHash || '').toLowerCase()
      const current = new Set(store.get('watchlist') || [])
      if (current.has(hash)) current.delete(hash)
      else current.add(hash)
      const next = [...current]
      store.set('watchlist', next)
      return next
    },

    updateSettings(partial) {
      const current = store.get('settings')
      const next = { ...current }
      if (typeof partial.cacheDir === 'string' && partial.cacheDir.trim()) {
        next.cacheDir = partial.cacheDir.trim()
      }
      if (typeof partial.keepCacheOnClose === 'boolean') {
        next.keepCacheOnClose = partial.keepCacheOnClose
      }
      if (typeof partial.tmdbApiKey === 'string') {
        next.tmdbApiKey = partial.tmdbApiKey.trim()
      }
      store.set('settings', next)
      return next
    },
  }
}

module.exports = { createStore }
