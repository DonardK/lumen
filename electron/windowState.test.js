const assert = require('node:assert/strict')
const test = require('node:test')
const { resolveWindowBounds, MIN_WIDTH, MIN_HEIGHT, DEFAULT_WIDTH, DEFAULT_HEIGHT } = require('./windowState')

const laptop = { x: 0, y: 0, width: 1920, height: 1080 }
const leftMonitor = { x: -1920, y: 0, width: 1920, height: 1080 }

test('keeps a window that sits fully inside a display', () => {
  const bounds = resolveWindowBounds(
    { x: 100, y: 80, width: 1280, height: 840, maximized: false },
    [laptop],
  )
  assert.deepEqual(bounds, { x: 100, y: 80, width: 1280, height: 840, maximized: false })
})

test('drops x and y when the window misses every display', () => {
  const bounds = resolveWindowBounds(
    { x: 4000, y: 4000, width: 1280, height: 840, maximized: true },
    [laptop],
  )
  assert.deepEqual(bounds, { width: 1280, height: 840, maximized: true })
})

test('keeps a window that is only partly on screen', () => {
  const bounds = resolveWindowBounds({ x: 1700, y: 900, width: 1280, height: 840 }, [laptop])
  assert.equal(bounds.x, 1700)
  assert.equal(bounds.y, 900)
  assert.equal(bounds.width, 1280)
  assert.equal(bounds.height, 840)
})

test('enforces minimum width and height', () => {
  const bounds = resolveWindowBounds({ x: 40, y: 40, width: 100, height: 50 }, [laptop])
  assert.equal(bounds.width, MIN_WIDTH)
  assert.equal(bounds.height, MIN_HEIGHT)
  assert.equal(bounds.x, 40)
  assert.equal(bounds.y, 40)
})

test('still drops position when min size cannot bring the window on screen', () => {
  const bounds = resolveWindowBounds({ x: 20000, y: 10, width: 10, height: 10 }, [laptop])
  assert.equal(bounds.x, undefined)
  assert.equal(bounds.y, undefined)
  assert.equal(bounds.width, MIN_WIDTH)
  assert.equal(bounds.height, MIN_HEIGHT)
})

test('keeps a window on a display left of the origin', () => {
  const bounds = resolveWindowBounds({ x: -1600, y: 40, width: 1100, height: 700 }, [laptop, leftMonitor])
  assert.equal(bounds.x, -1600)
  assert.equal(bounds.y, 40)
  assert.equal(bounds.width, 1100)
  assert.equal(bounds.height, 700)
})

test('treats an edge-only touch as off screen', () => {
  const bounds = resolveWindowBounds({ x: 1920, y: 0, width: 900, height: 700 }, [laptop])
  assert.equal(bounds.x, undefined)
  assert.equal(bounds.width, 900)
  assert.equal(bounds.height, 700)
})

test('uses defaults when saved state is missing or unusable', () => {
  const missing = resolveWindowBounds(null, [laptop])
  assert.equal(missing.width, DEFAULT_WIDTH)
  assert.equal(missing.height, DEFAULT_HEIGHT)
  assert.equal(missing.x, undefined)
  assert.equal(missing.maximized, false)

  const broken = resolveWindowBounds({ width: 0, height: -5, x: 10, y: 10 }, [laptop])
  assert.equal(broken.width, DEFAULT_WIDTH)
  assert.equal(broken.height, DEFAULT_HEIGHT)
  assert.equal(broken.x, 10)
  assert.equal(broken.y, 10)
})

test('drops position when no displays are available', () => {
  const bounds = resolveWindowBounds({ x: 10, y: 10, width: 1000, height: 700 }, [])
  assert.equal(bounds.x, undefined)
  assert.equal(bounds.y, undefined)
  assert.equal(bounds.width, 1000)
  assert.equal(bounds.height, 700)
})
