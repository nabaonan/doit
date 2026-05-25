const fs = require("fs")
const path = require("path")
const zlib = require("zlib")

const iconsDir = path.join(__dirname, "..", "src-tauri", "icons")
fs.mkdirSync(iconsDir, { recursive: true })

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, Buffer.from(type, "ascii"), data, crcBuf])
}

function buildPNG(w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(w, 0)
  ihdrData.writeUInt32BE(h, 4)
  ihdrData[8] = 8
  ihdrData[9] = 6
  const ihdr = pngChunk("IHDR", ihdrData)

  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 4)
    raw[off] = 0
    for (let x = 0; x < w; x++) {
      const p = off + 1 + x * 4
      raw[p] = 0x6b
      raw[p + 1] = 0x8f
      raw[p + 2] = 0xff
      raw[p + 3] = 0xff
    }
  }
  const compressed = zlib.deflateSync(raw)
  const idat = pngChunk("IDAT", compressed)

  const iend = pngChunk("IEND", Buffer.alloc(0))

  return Buffer.concat([sig, ihdr, idat, iend])
}

const png32 = buildPNG(32, 32)
fs.writeFileSync(path.join(iconsDir, "32x32.png"), png32)

const png128 = buildPNG(128, 128)
fs.writeFileSync(path.join(iconsDir, "128x128.png"), png128)

const png256 = buildPNG(256, 256)
fs.writeFileSync(path.join(iconsDir, "128x128@2x.png"), png256)

const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(1, 4)

const dirEntry = Buffer.alloc(16)
dirEntry[0] = 32
dirEntry[1] = 32
dirEntry[2] = 0
dirEntry[3] = 0
dirEntry.writeUInt16LE(1, 4)
dirEntry.writeUInt16LE(32, 6)
dirEntry.writeUInt32LE(png32.length, 8)
dirEntry.writeUInt32LE(22, 12)

fs.writeFileSync(path.join(iconsDir, "icon.ico"), Buffer.concat([icoHeader, dirEntry, png32]))
fs.writeFileSync(path.join(iconsDir, "icon.icns"), png128)

console.log("Icons generated: " + iconsDir)
console.log("  32x32.png, 128x128.png, 128x128@2x.png, icon.ico, icon.icns")