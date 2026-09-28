const fs = require('fs')
const path = require('path')

const MAX_BYTES = 5 * 1024 * 1024
const MAX_BUFFER = 1000

const buffer = []
let filePath = ''
let opened = false

function stamp() {
  try {
    return new Date().toISOString()
  } catch {
    return ''
  }
}

function textOf(value) {
  try {
    if (value instanceof Error) return value.stack || value.message || 'Error'
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '[unprintable]'
    }
  }
}

function line(level, args) {
  return `${stamp()} [${level}] ${args.map(textOf).join(' ')}\n`
}

function pushBuffer(entry) {
  buffer.push(entry)
  if (buffer.length > MAX_BUFFER) buffer.shift()
}

function write(entry) {
  try {
    if (!opened || !filePath) {
      pushBuffer(entry)
      return
    }
    fs.appendFileSync(filePath, entry)
  } catch {
    pushBuffer(entry)
  }
}

function mirror(level, args) {
  try {
    if (level === 'error') console.error(...args)
    else if (level === 'warn') console.warn(...args)
    else console.log(...args)
  } catch {
    // console itself can fail when stdout is gone
  }
}

function emit(level, args) {
  mirror(level, args)
  write(line(level, args))
}

function info(...args) {
  emit('info', args)
}

function warn(...args) {
  emit('warn', args)
}

function error(...args) {
  emit('error', args)
}

function rotate(target) {
  try {
    const stat = fs.statSync(target)
    if (!stat.isFile() || stat.size <= MAX_BYTES) return
    const oldPath = path.join(path.dirname(target), 'main.old.log')
    fs.rmSync(oldPath, { force: true })
    fs.renameSync(target, oldPath)
  } catch {
    // missing file, or the previous log is locked — keep appending
  }
}

function attach(app) {
  try {
    const dir = app.getPath('logs')
    fs.mkdirSync(dir, { recursive: true })
    const target = path.join(dir, 'main.log')
    rotate(target)
    filePath = target
    opened = true
    flush()
  } catch {
    // stay buffered. logging must never take the app down
  }
}

function flush() {
  if (!opened || !filePath || buffer.length === 0) return
  const pending = buffer.splice(0, buffer.length)
  try {
    fs.appendFileSync(filePath, pending.join(''))
  } catch {
    buffer.unshift(...pending)
    if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER)
  }
}

function logPath() {
  return filePath
}

process.on('exit', () => {
  try {
    flush()
  } catch {
    // exit handlers must not throw
  }
})

module.exports = { info, warn, error, attach, flush, logPath }
