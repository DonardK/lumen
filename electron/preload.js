const { contextBridge, ipcRenderer, webUtils } = require('electron')

function subscribe(channel, listener) {
  const wrapped = (_event, payload) => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

contextBridge.exposeInMainWorld('api', {
  addTorrent(input) {
    return ipcRenderer.invoke('torrent:add', input)
  },
  selectFile(infoHash, fileIndex) {
    return ipcRenderer.invoke('torrent:select-file', infoHash, fileIndex)
  },
  removeTorrent(infoHash) {
    return ipcRenderer.invoke('torrent:remove', infoHash)
  },
  pickTorrentFile() {
    return ipcRenderer.invoke('torrent:pick-file')
  },
  pickCacheDir() {
    return ipcRenderer.invoke('settings:pick-dir')
  },
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
  getLibrary() {
    return ipcRenderer.invoke('library:get')
  },
  upsertLibrary(entry) {
    return ipcRenderer.invoke('library:upsert', entry)
  },
  removeLibraryEntry(infoHash) {
    return ipcRenderer.invoke('library:remove-entry', infoHash)
  },
  getWatchlist() {
    return ipcRenderer.invoke('watchlist:get')
  },
  toggleWatchlist(infoHash) {
    return ipcRenderer.invoke('watchlist:toggle', infoHash)
  },
  getSettings() {
    return ipcRenderer.invoke('settings:get')
  },
  updateSettings(partial) {
    return ipcRenderer.invoke('settings:set', partial)
  },
  saveProgress(payload) {
    return ipcRenderer.invoke('progress:save', payload)
  },
  flushProgress(payload) {
    ipcRenderer.send('progress:flush', payload)
  },
  onStats(listener) {
    return subscribe('torrent:stats', listener)
  },
  onTorrentError(listener) {
    return subscribe('torrent:error', listener)
  },
})
