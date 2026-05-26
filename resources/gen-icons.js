// Generates icon.png (16x16 tray) and icon.ico (256x256 installer).
// Draws an Archimedean spiral that stops mid-coil — a "broken spiral".
// Run: node resources/gen-icons.js
'use strict'
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const OUT = __dirname

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// ── Rasteriser ─────────────────────────────────────────────────────────────
// RGBA canvas (Uint8Array, row-major)
function makeCanvas(size) {
  return new Uint8Array(size * size * 4)  // all transparent
}

function setPixel(canvas, size, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  // Alpha-blend onto existing
  const srcA = a / 255
  const dstA = canvas[i + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA === 0) return
  canvas[i]     = Math.round((r * srcA + canvas[i]     * dstA * (1 - srcA)) / outA)
  canvas[i + 1] = Math.round((g * srcA + canvas[i + 1] * dstA * (1 - srcA)) / outA)
  canvas[i + 2] = Math.round((b * srcA + canvas[i + 2] * dstA * (1 - srcA)) / outA)
  canvas[i + 3] = Math.round(outA * 255)
}

// Wu-style anti-aliased thick line between two points
function drawLine(canvas, size, x0, y0, x1, y1, r, g, b, thickness) {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4)
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const cx = x0 + (x1 - x0) * t
    const cy = y0 + (y1 - y0) * t
    const half = thickness / 2
    for (let dy = -Math.ceil(half + 1); dy <= Math.ceil(half + 1); dy++) {
      for (let dx = -Math.ceil(half + 1); dx <= Math.ceil(half + 1); dx++) {
        const px = Math.round(cx) + dx
        const py = Math.round(cy) + dy
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
        const alpha = Math.max(0, Math.min(1, half - dist + 0.5))
        if (alpha > 0) setPixel(canvas, size, px, py, r, g, b, Math.round(alpha * 255))
      }
    }
  }
}

// Draw a stopped Archimedean spiral
// Params: canvas size, ink colour, bg colour, stroke thickness (fraction of size)
function renderSpiral(size, inkR, inkG, inkB, bgR, bgG, bgB, strokeFrac) {
  const canvas = makeCanvas(size)

  // Fill background
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4]     = bgR
    canvas[i * 4 + 1] = bgG
    canvas[i * 4 + 2] = bgB
    canvas[i * 4 + 3] = 255
  }

  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.42        // spiral outer radius
  const gap = maxR / 3.2         // gap between arms
  const thickness = size * strokeFrac
  const totalAngle = Math.PI * 2 * 2.6  // ~2.6 full turns

  // The spiral stops abruptly at ~80% — that's the "interrupted" moment
  const stopAt = 0.80

  const STEPS = size * 20
  let prevX = null, prevY = null

  for (let s = 0; s <= STEPS; s++) {
    const frac = s / STEPS
    if (frac > stopAt) break

    const angle = frac * totalAngle - Math.PI / 2  // start from top
    const radius = (frac / stopAt) * maxR

    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)

    if (prevX !== null) {
      // Fade stroke slightly toward the end to sell the "trailing off"
      const fade = frac < stopAt * 0.7 ? 1 : 1 - (frac - stopAt * 0.7) / (stopAt * 0.3) * 0.5
      const strokeAlpha = Math.round(fade * 255)
      // We draw with full alpha then blend; easier to just scale the thickness
      const t = thickness * (0.6 + 0.4 * fade)
      drawLine(canvas, size, prevX, prevY, x, y, inkR, inkG, inkB, t)
    }
    prevX = x; prevY = y
  }

  return canvas
}

// ── PNG encoder ────────────────────────────────────────────────────────────
function canvasToPNG(canvas, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6  // RGBA

  const raw = Buffer.alloc((1 + size * 4) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (1 + size * 4) + 1 + x * 4
      raw[dst]     = canvas[src]
      raw[dst + 1] = canvas[src + 1]
      raw[dst + 2] = canvas[src + 2]
      raw[dst + 3] = canvas[src + 3]
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ── ICO wrapper (PNG-in-ICO, Vista+ format) ────────────────────────────────
function makeICO(pngData) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0; entry[1] = 0; entry[2] = 0; entry[3] = 0
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(pngData.length, 8); entry.writeUInt32LE(6 + 16, 12)
  return Buffer.concat([header, entry, pngData])
}

// ── Generate ───────────────────────────────────────────────────────────────
// Palette: paper bg #fafaf7, ink stroke #1e1e1e
const BG  = [0xfa, 0xfa, 0xf7]
const INK = [0x1e, 0x1e, 0x1e]

// 16×16 tray icon (slightly thicker stroke for legibility)
const tray = renderSpiral(16, ...INK, ...BG, 0.18)
fs.writeFileSync(path.join(OUT, 'icon.png'), canvasToPNG(tray, 16))
console.log('icon.png written (16×16 stopped spiral)')

// 256×256 for installer ICO
const big = renderSpiral(256, ...INK, ...BG, 0.055)
fs.writeFileSync(path.join(OUT, 'icon.ico'), makeICO(canvasToPNG(big, 256)))
console.log('icon.ico written (256×256 stopped spiral)')
