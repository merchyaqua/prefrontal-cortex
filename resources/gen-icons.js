// Generates icon.png (16x16 tray) and icon.ico (256x256 installer) with no extra deps.
// Run: node resources/gen-icons.js
'use strict'
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const OUT = __dirname

// CRC32 table
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

function makePNG(size, r, g, b) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit RGB

  // Raw pixel rows: filter byte (0) + RGB * width
  const raw = Buffer.alloc((1 + size * 3) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3)
    raw[row] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      raw[row + 1 + x * 3] = r
      raw[row + 1 + x * 3 + 1] = g
      raw[row + 1 + x * 3 + 2] = b
    }
  }

  const idat = zlib.deflateSync(raw)

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG sig
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function makeICO(pngData) {
  // ICO wrapping a PNG — Vista+ format, accepted by electron-builder
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)  // reserved
  header.writeUInt16LE(1, 2)  // type: icon
  header.writeUInt16LE(1, 4)  // 1 image

  const entry = Buffer.alloc(16)
  entry[0] = 0; entry[1] = 0  // 0 = 256 in ICO spec
  entry[2] = 0; entry[3] = 0
  entry.writeUInt16LE(1, 4)   // color planes
  entry.writeUInt16LE(32, 6)  // bits per pixel
  entry.writeUInt32LE(pngData.length, 8)
  entry.writeUInt32LE(6 + 16, 12)  // offset to image data

  return Buffer.concat([header, entry, pngData])
}

// 16x16 dark (#1e1e1e) PNG for system tray
const trayPng = makePNG(16, 0x1e, 0x1e, 0x1e)
fs.writeFileSync(path.join(OUT, 'icon.png'), trayPng)
console.log('icon.png written (16x16)')

// 256x256 PNG embedded in ICO for installer / taskbar
const bigPng = makePNG(256, 0x1e, 0x1e, 0x1e)
const ico = makeICO(bigPng)
fs.writeFileSync(path.join(OUT, 'icon.ico'), ico)
console.log('icon.ico written (256x256 PNG-in-ICO)')
