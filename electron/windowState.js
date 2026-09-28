const MIN_WIDTH = 880
const MIN_HEIGHT = 640
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 840

function asRect(area) {
  if (!area) return null
  const x = Number(area.x)
  const y = Number(area.y)
  const width = Number(area.width)
  const height = Number(area.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function rectsIntersect(a, b) {
  const left = asRect(a)
  const right = asRect(b)
  if (!left || !right) return false
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

function clampSize(value, min, fallback) {
  const base = Number.isFinite(value) && value > 0 ? value : fallback
  return Math.max(min, base)
}

function resolveWindowBounds(saved, workAreas, options = {}) {
  const minWidth = options.minWidth ?? MIN_WIDTH
  const minHeight = options.minHeight ?? MIN_HEIGHT
  const defaultWidth = options.defaultWidth ?? DEFAULT_WIDTH
  const defaultHeight = options.defaultHeight ?? DEFAULT_HEIGHT
  const width = clampSize(saved && saved.width, minWidth, defaultWidth)
  const height = clampSize(saved && saved.height, minHeight, defaultHeight)
  const maximized = Boolean(saved && saved.maximized)
  const bounds = { width, height, maximized }
  const x = saved && saved.x
  const y = saved && saved.y
  if (!Number.isFinite(x) || !Number.isFinite(y)) return bounds
  const areas = Array.isArray(workAreas) ? workAreas : []
  const visible = areas.some((area) => rectsIntersect({ x, y, width, height }, area))
  if (!visible) return bounds
  return { ...bounds, x, y }
}

module.exports = {
  MIN_WIDTH,
  MIN_HEIGHT,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  rectsIntersect,
  resolveWindowBounds,
}
