// Generates icon.png (16x16 tray) and icon.ico (256x256 installer).
// Tray:      single thick broken arc — legible at tiny sizes
// Installer: multi-turn Archimedean spiral that stops mid-coil
// Run: node resources/gen-icons.js
'use strict'
const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')
const OUT  = __dirname

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
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0)
  const tp = Buffer.from(type, 'ascii')
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([tp, data])), 0)
  return Buffer.concat([l, tp, data, cr])
}

// ── RGBA canvas ─────────────────────────────────────────────────────────────
function makeCanvas(size, bgR, bgG, bgB, bgA = 255) {
  const c = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    c[i*4]=bgR; c[i*4+1]=bgG; c[i*4+2]=bgB; c[i*4+3]=bgA
  }
  return c
}
function setPixel(c, size, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  const sa = a/255, da = c[i+3]/255, oa = sa + da*(1-sa)
  if (oa === 0) return
  c[i]   = Math.round((r*sa + c[i]  *da*(1-sa))/oa)
  c[i+1] = Math.round((g*sa + c[i+1]*da*(1-sa))/oa)
  c[i+2] = Math.round((b*sa + c[i+2]*da*(1-sa))/oa)
  c[i+3] = Math.round(oa*255)
}
function drawLine(c, size, x0, y0, x1, y1, r, g, b, thickness) {
  const steps = Math.ceil(Math.max(Math.abs(x1-x0), Math.abs(y1-y0)) * 4)
  for (let s = 0; s <= steps; s++) {
    const t = s/steps
    const cx = x0 + (x1-x0)*t, cy = y0 + (y1-y0)*t
    const half = thickness/2
    for (let dy = -Math.ceil(half+1); dy <= Math.ceil(half+1); dy++) {
      for (let dx = -Math.ceil(half+1); dx <= Math.ceil(half+1); dx++) {
        const px = Math.round(cx)+dx, py = Math.round(cy)+dy
        const dist = Math.sqrt((px-cx)**2 + (py-cy)**2)
        const alpha = Math.max(0, Math.min(1, half - dist + 0.5))
        if (alpha > 0) setPixel(c, size, px, py, r, g, b, Math.round(alpha*255))
      }
    }
  }
}

// ── PNG encoder ─────────────────────────────────────────────────────────────
function canvasToPNG(canvas, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6  // RGBA
  const raw = Buffer.alloc((1 + size*4) * size)
  for (let y = 0; y < size; y++) {
    raw[y*(1+size*4)] = 0
    for (let x = 0; x < size; x++) {
      const src = (y*size+x)*4, dst = y*(1+size*4)+1+x*4
      raw[dst]=canvas[src]; raw[dst+1]=canvas[src+1]
      raw[dst+2]=canvas[src+2]; raw[dst+3]=canvas[src+3]
    }
  }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ── ICO (PNG-in-ICO, Vista+ format) ─────────────────────────────────────────
function makeICO(pngData) {
  const hdr = Buffer.alloc(6)
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4)
  const ent = Buffer.alloc(16)
  ent[0]=0; ent[1]=0; ent[2]=0; ent[3]=0
  ent.writeUInt16LE(1, 4); ent.writeUInt16LE(32, 6)
  ent.writeUInt32LE(pngData.length, 8); ent.writeUInt32LE(22, 12)
  return Buffer.concat([hdr, ent, pngData])
}

// ── Design 1: broken arc (tray, 16×16) ──────────────────────────────────────
// A single-turn arc (~300°) with transparent background.
// Clear gap + abrupt endpoint = "stopped" at any tiny size.
function renderBrokenArc(size) {
  const c = makeCanvas(size, 0, 0, 0, 0)  // transparent bg
  const cx = size/2, cy = size/2
  const r  = size * 0.36
  const thickness = size * 0.22
  const startAngle = Math.PI * 0.25   // start ~bottom-left, going clockwise
  const sweep      = Math.PI * 1.67   // ~300° — leave a visible gap at top-right
  const STEPS = 120
  let px = null, py = null
  for (let s = 0; s <= STEPS; s++) {
    const frac  = s / STEPS
    const angle = startAngle + frac * sweep
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    if (px !== null) drawLine(c, size, px, py, x, y, 0x1e, 0x1e, 0x1e, thickness)
    px = x; py = y
  }
  return c
}

// ── Design 2: stopped spiral (installer, 256×256) ───────────────────────────
function renderSpiral(size) {
  const c  = makeCanvas(size, 0xfa, 0xfa, 0xf7)
  const cx = size/2, cy = size/2
  const maxR      = size * 0.42
  const thickness = size * 0.055
  const totalAngle = Math.PI * 2 * 2.6
  const stopAt    = 0.80
  const STEPS     = size * 20
  let px = null, py = null
  for (let s = 0; s <= STEPS; s++) {
    const frac = s / STEPS
    if (frac > stopAt) break
    const angle  = frac * totalAngle - Math.PI/2
    const radius = (frac / stopAt) * maxR
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    if (px !== null) {
      const fade = frac < stopAt*0.7 ? 1 : 1 - (frac - stopAt*0.7)/(stopAt*0.3)*0.5
      drawLine(c, size, px, py, x, y, 0x1e, 0x1e, 0x1e, thickness*(0.6+0.4*fade))
    }
    px = x; py = y
  }
  return c
}

// ── Write files ─────────────────────────────────────────────────────────────
const tray = renderBrokenArc(16)
fs.writeFileSync(path.join(OUT, 'icon.png'), canvasToPNG(tray, 16))
console.log('icon.png  written (16×16 broken arc, transparent)')

const big = renderSpiral(256)
fs.writeFileSync(path.join(OUT, 'icon.ico'), makeICO(canvasToPNG(big, 256)))
console.log('icon.ico  written (256×256 stopped spiral)')
