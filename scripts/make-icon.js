'use strict';

const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Capture must be exactly N×N, not N×devicePixelRatio.
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');

const ROOT = path.join(__dirname, '..');
const AMBER = { r: 249, g: 191, b: 96 }; // oklch(0.84 0.13 78) -> #f9bf60
const INK = { r: 13, g: 17, b: 27 }; // oklch(0.18 0.02 265) -> #0d111b

// <=32 uses the thicker-stroke SVG. 180 is the apple touch icon.
const LARGE_SIZES = [48, 64, 128, 180, 256, 512];
const SMALL_SIZES = [16, 24, 32];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

const safety = setTimeout(() => {
  console.error('make-icon: timed out after 30s');
  app.exit(1);
}, 30000);

function pageShell() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;overflow:hidden;background:transparent}
    img{display:block;margin:0;padding:0;border:0}
  </style></head><body><img id="icon" alt=""></body></html>`;
}

function dist(pixel, color) {
  return Math.abs(pixel.r - color.r) + Math.abs(pixel.g - color.g) + Math.abs(pixel.b - color.b);
}

function analyze(image) {
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  let transparent = 0;
  let amber = 0;
  let ink = 0;
  let dark = 0;
  let maxAlpha = 0;
  for (let i = 0; i < bitmap.length; i += 4) {
    const b = bitmap[i];
    const g = bitmap[i + 1];
    const r = bitmap[i + 2];
    const a = bitmap[i + 3];
    if (a > maxAlpha) maxAlpha = a;
    if (a < 16) {
      transparent++;
      continue;
    }
    const pixel = { r, g, b, a };
    if (a > 200 && dist(pixel, AMBER) <= 48) amber++;
    if (a > 160 && dist(pixel, INK) <= 70) ink++;
    if (a > 140 && r < 90 && g < 80 && b < 110) dark++;
  }
  return { width, height, transparent, amber, ink, dark, maxAlpha, total: width * height };
}

function assertIcon(stats, size) {
  if (!stats || stats.width !== size || stats.height !== size) {
    throw new Error(`size ${size}: got ${stats ? stats.width + 'x' + stats.height : 'no image'}`);
  }
  if (stats.maxAlpha === 0) {
    throw new Error(`size ${size}: fully transparent`);
  }
  const amberFloor = size >= 48 ? 0.35 : 0.15;
  if (stats.amber < stats.total * amberFloor) {
    throw new Error(`size ${size}: expected an amber tile: ${JSON.stringify(stats)}`);
  }
  if (size >= 32 && stats.dark < 1) {
    throw new Error(`size ${size}: expected an ink aperture: ${JSON.stringify(stats)}`);
  }
  if (size >= 48 && stats.transparent < 1) {
    throw new Error(`size ${size}: no transparent corner pixels: ${JSON.stringify(stats)}`);
  }
  if (size >= 128 && stats.ink < stats.total * 0.004) {
    throw new Error(`size ${size}: aperture stroke missing: ${JSON.stringify(stats)}`);
  }
}

function sample(image, x, y) {
  const { width } = image.getSize();
  const bitmap = image.toBitmap();
  const i = (y * width + x) * 4;
  return { b: bitmap[i], g: bitmap[i + 1], r: bitmap[i + 2], a: bitmap[i + 3] };
}

function assertSamples(image, size) {
  if (size < 32) return;
  const corner = sample(image, 0, 0);
  const top = sample(image, Math.floor(size / 2), Math.max(1, Math.floor(size * 0.08)));
  console.log(`sample ${size} corner=${JSON.stringify(corner)} top=${JSON.stringify(top)}`);
  if (size >= 64 && corner.a > 24) {
    throw new Error(`${size} corner is not transparent`);
  }
  if (size >= 64 && (top.a < 200 || dist(top, AMBER) > 36)) {
    throw new Error(`${size} tile is not amber: ${JSON.stringify(top)}`);
  }
}

function pngSize(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig)) {
    throw new Error('missing PNG signature');
  }
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('missing IHDR');
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function assertPngBuffer(png, size) {
  const dims = pngSize(png);
  if (dims.width !== size || dims.height !== size) {
    throw new Error(`png ihdr ${dims.width}x${dims.height} != ${size}`);
  }
  const image = nativeImage.createFromBuffer(png);
  const stats = analyze(image);
  assertIcon(stats, size);
  assertSamples(image, size);
  if ((size === 256 || size === 512) && png.length <= 2048) {
    throw new Error(`${size} png is only ${png.length} bytes`);
  }
  return stats;
}

function buildIco(entries) {
  const count = entries.length;
  let offset = 6 + count * 16;
  const dir = entries.map((entry) => {
    const item = {
      dim: entry.size >= 256 ? 0 : entry.size,
      bytes: entry.png.length,
      offset,
    };
    offset += entry.png.length;
    return item;
  });
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  entries.forEach((entry, i) => {
    const base = 6 + i * 16;
    const item = dir[i];
    out.writeUInt8(item.dim, base);
    out.writeUInt8(item.dim, base + 1);
    out.writeUInt8(0, base + 2);
    out.writeUInt8(0, base + 3);
    out.writeUInt16LE(1, base + 4);
    out.writeUInt16LE(32, base + 6);
    out.writeUInt32LE(item.bytes, base + 8);
    out.writeUInt32LE(item.offset, base + 12);
    entry.png.copy(out, item.offset);
  });
  return out;
}

function fit(image, size) {
  if (!image || image.isEmpty()) return image;
  const got = image.getSize();
  if (got.width === size && got.height === size) return image;
  console.log(`resize ${got.width}x${got.height} -> ${size}x${size}`);
  return image.resize({ width: size, height: size, quality: 'best' });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureSize(win, size) {
  const rect = { x: 0, y: 0, width: size, height: size };
  let lastError = new Error(`capture failed for ${size}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await delay(60);
    const image = fit(await win.webContents.capturePage(rect, { stayHidden: true }), size);
    const stats = image && !image.isEmpty() ? analyze(image) : null;
    try {
      assertIcon(stats, size);
      return image;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function showFrame(win, svgDataUrl, size) {
  win.setContentSize(size, size);
  await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const img = document.getElementById('icon');
    const s = ${size};
    const src = ${JSON.stringify(svgDataUrl)};
    document.documentElement.style.width = s + 'px';
    document.documentElement.style.height = s + 'px';
    document.body.style.width = s + 'px';
    document.body.style.height = s + 'px';
    img.width = s;
    img.height = s;
    img.style.width = s + 'px';
    img.style.height = s + 'px';
    const done = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
    if (img.getAttribute('data-src') === src && img.complete && img.naturalWidth > 0) {
      done();
      return;
    }
    img.onload = () => {
      img.setAttribute('data-src', src);
      done();
    };
    img.onerror = () => reject(new Error('svg image failed'));
    img.src = src;
  })`);
  if (win.webContents.isOffscreen()) win.webContents.invalidate();
  await delay(30);
}

async function rasterizeGroups(groups) {
  const max = 512;
  const htmlPath = path.join(os.tmpdir(), `lumen-make-icon-${process.pid}.html`);
  fs.writeFileSync(htmlPath, pageShell(), 'utf8');

  const win = new BrowserWindow({
    width: max,
    height: max,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    thickFrame: false,
    backgroundColor: '#00000000',
    backgroundMaterial: 'none',
    paintWhenInitiallyHidden: true,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      zoomFactor: 1,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    if (!win.webContents.isPainting()) win.webContents.startPainting();
    win.setContentSize(max, max);
    await win.loadFile(htmlPath);
    const images = new Map();
    for (const group of groups) {
      const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(group.svg);
      for (const size of group.sizes) {
        await showFrame(win, svgDataUrl, size);
        const image = await captureSize(win, size);
        console.log(`rendered ${size} ${group.label} ${JSON.stringify(analyze(image))}`);
        images.set(size, image);
      }
    }
    return images;
  } finally {
    if (!win.isDestroyed()) win.destroy();
    fs.rmSync(htmlPath, { force: true });
  }
}

async function main() {
  const buildDir = path.join(ROOT, 'build');
  const largeSvg = fs.readFileSync(path.join(buildDir, 'icon.svg'), 'utf8');
  const smallSvg = fs.readFileSync(path.join(buildDir, 'icon-small.svg'), 'utf8');
  if (largeSvg.includes('prefers-color-scheme') || smallSvg.includes('prefers-color-scheme')) {
    throw new Error('icon svg must use explicit fills');
  }
  if (!largeSvg.includes('#f9bf60') || !largeSvg.includes('#0d111b') || !largeSvg.includes('r="10"')) {
    throw new Error('build/icon.svg is missing the Lumen amber tile or lucide aperture geometry');
  }

  const images = await rasterizeGroups([
    { label: 'stroke-2', svg: largeSvg, sizes: LARGE_SIZES },
    { label: 'stroke-2.4', svg: smallSvg, sizes: SMALL_SIZES },
  ]);

  const pngBySize = new Map();
  for (const size of [...LARGE_SIZES, ...SMALL_SIZES]) {
    const png = images.get(size).toPNG();
    assertPngBuffer(png, size);
    pngBySize.set(size, png);
  }

  const iconsDir = path.join(buildDir, 'icons');
  const publicDir = path.join(ROOT, 'public');
  fs.mkdirSync(iconsDir, { recursive: true });
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    fs.writeFileSync(path.join(iconsDir, `${size}.png`), pngBySize.get(size));
  }
  fs.writeFileSync(path.join(buildDir, 'icon.png'), pngBySize.get(512));
  fs.copyFileSync(path.join(buildDir, 'icon.svg'), path.join(publicDir, 'icon.svg'));
  fs.writeFileSync(path.join(publicDir, 'apple-icon.png'), pngBySize.get(180));
  fs.writeFileSync(path.join(publicDir, 'icon-light-32x32.png'), pngBySize.get(32));
  fs.writeFileSync(path.join(publicDir, 'icon-dark-32x32.png'), pngBySize.get(32));

  const ico = buildIco(ICO_SIZES.map((size) => ({ size, png: pngBySize.get(size) })));
  const icoPath = path.join(buildDir, 'icon.ico');
  fs.writeFileSync(icoPath, ico);
  console.log(`wrote ${icoPath} (${ico.length} bytes)`);
  console.log(`256 png ${pngBySize.get(256).length} bytes; 512 png ${pngBySize.get(512).length} bytes; apple ${pngBySize.get(180).length} bytes`);
}

app.whenReady().then(async () => {
  try {
    await main();
    clearTimeout(safety);
    app.quit();
  } catch (err) {
    console.error(err);
    clearTimeout(safety);
    app.exit(1);
  }
}).catch((err) => {
  console.error(err);
  clearTimeout(safety);
  app.exit(1);
});
