const assert = require('node:assert/strict')
const test = require('node:test')
const { parseTitleYear } = require('./metadata')

test('strips resolution, codec, and release group', () => {
  const parsed = parseTitleYear('The.Matrix.1999.1080p.BluRay.x265-GROUP.mkv')
  assert.equal(parsed.title, 'The Matrix')
  assert.equal(parsed.year, 1999)
})

test('reads a parenthetical year and drops bracket tags', () => {
  const parsed = parseTitleYear('Dune (2021) [2160p] [HEVC].mkv')
  assert.equal(parsed.title, 'Dune')
  assert.equal(parsed.year, 2021)
})

test('keeps a title that has no year', () => {
  const parsed = parseTitleYear('Big Buck Bunny 1080p.mp4')
  assert.equal(parsed.title, 'Big Buck Bunny')
  assert.equal(parsed.year, null)
})

test('falls back to the raw filename when nothing is left', () => {
  const parsed = parseTitleYear('1080p.mkv')
  assert.equal(parsed.year, null)
  assert.equal(parsed.title.length > 0, true)
})
