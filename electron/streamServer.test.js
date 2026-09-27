const assert = require('node:assert/strict')
const test = require('node:test')
const { chooseVideoFiles, prioritizePlayback } = require('./streamServer')

function file(path, length, offset = 0) {
  return { path, length, offset, select() {} }
}

test('chooseVideoFiles picks the largest video when others are much smaller', () => {
  const torrent = {
    files: [
      file('Movie.srt', 50_000),
      file('Movie.mkv', 1_000_000_000),
      file('Extra.mkv', 100_000),
    ],
  }
  const result = chooseVideoFiles(torrent)
  assert.equal(result.needsSelection, false)
  assert.equal(result.suggestedFileIndex, 1)
  assert.deepEqual(result.files, [{ index: 1, name: 'Movie.mkv', length: 1_000_000_000 }])
})

test('chooseVideoFiles flags similar-size videos for selection', () => {
  const torrent = {
    files: [
      file('CutA.mkv', 1_000_000),
      file('CutB.mkv', 850_000),
      file('Notes.txt', 900_000),
    ],
  }
  const result = chooseVideoFiles(torrent)
  assert.equal(result.needsSelection, true)
  assert.equal(result.suggestedFileIndex, 0)
  assert.deepEqual(
    result.files.map((entry) => entry.name),
    ['CutA.mkv', 'CutB.mkv'],
  )
})

test('chooseVideoFiles throws no-playable-file when nothing is a video', () => {
  const torrent = {
    files: [file('readme.nfo', 500), file('movie.txt', 900), file('empty.mkv', 0)],
  }
  assert.throws(
    () => chooseVideoFiles(torrent),
    (error) => {
      assert.equal(error.code, 'no-playable-file')
      return true
    },
  )
})

test('chooseVideoFiles excludes sample-prefixed files', () => {
  const torrent = {
    files: [file('Movie/sample.mkv', 2_000_000), file('Movie/Movie.mkv', 1_000_000)],
  }
  const result = chooseVideoFiles(torrent)
  assert.equal(result.needsSelection, false)
  assert.equal(result.suggestedFileIndex, 1)
  assert.deepEqual(result.files, [{ index: 1, name: 'Movie/Movie.mkv', length: 1_000_000 }])
})

test('chooseVideoFiles excludes non-video extensions', () => {
  const torrent = {
    files: [
      file('Movie.mp4', 500_000),
      file('Movie.iso', 9_000_000),
      file('Movie.sfv', 9_000_000),
      file('Movie', 9_000_000),
    ],
  }
  const result = chooseVideoFiles(torrent)
  assert.deepEqual(result.files, [{ index: 0, name: 'Movie.mp4', length: 500_000 }])
})

function fakeTorrent(count, files) {
  const deselectCalls = []
  const criticalCalls = []
  return {
    files,
    pieces: Array.from({ length: count }, () => ({})),
    pieceLength: 16384,
    deselect: (start, end, priority) => deselectCalls.push([start, end, priority]),
    critical: (start, end) => criticalCalls.push([start, end]),
    deselectCalls,
    criticalCalls,
  }
}

test('prioritizePlayback deselects everything, selects the file, marks head and tail critical', () => {
  const a = { offset: 0, length: 163_840, path: 'a.mkv', selectCalls: [] }
  a.select = (priority) => a.selectCalls.push(priority)
  const b = { offset: 163_840, length: 163_840, path: 'b.mkv', selectCalls: [] }
  b.select = (priority) => b.selectCalls.push(priority)
  const torrent = fakeTorrent(40, [a, b])

  prioritizePlayback(torrent, a)

  // Whole-torrent drop to priority 0 happens first.
  assert.deepEqual(torrent.deselectCalls[0], [0, 39, 0])
  // Every file range is dropped to 0 then cleared from priority 1.
  assert.deepEqual(torrent.deselectCalls.slice(1), [
    [0, 9, 0],
    [0, 9, 1],
    [10, 19, 0],
    [10, 19, 1],
  ])
  // Only the chosen file is re-selected.
  assert.deepEqual(a.selectCalls, [1])
  assert.deepEqual(b.selectCalls, [])
  // Head (first 5%, min 1) and tail (last 1%, min 1) of the 10-piece file.
  assert.deepEqual(torrent.criticalCalls, [
    [0, 0],
    [9, 9],
  ])
})

test('prioritizePlayback tolerates torrents without critical()', () => {
  const a = { offset: 0, length: 163_840, path: 'a.mkv', select() {} }
  const torrent = fakeTorrent(10, [a])
  delete torrent.critical
  prioritizePlayback(torrent, a)
  assert.deepEqual(torrent.deselectCalls[0], [0, 9, 0])
})

test('prioritizePlayback is a no-op with no pieces', () => {
  const a = { offset: 0, length: 163_840, path: 'a.mkv', selectCalls: [] }
  a.select = (priority) => a.selectCalls.push(priority)
  const torrent = fakeTorrent(0, [a])
  prioritizePlayback(torrent, a)
  assert.deepEqual(torrent.deselectCalls, [])
  assert.deepEqual(a.selectCalls, [])
})
