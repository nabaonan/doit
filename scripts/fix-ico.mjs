import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = resolve(__dirname, '..', 'src-tauri', 'icons')

const sizes = [16, 32, 48, 64, 128, 256]

const pngBuffers = sizes.map((size) => {
  const filename = size === 256 ? '128x128@2x.png' : size === 128 ? '128x128.png' : size === 32 ? '32x32.png' : null
  if (filename) {
    return readFileSync(resolve(iconsDir, filename))
  }
  return null
})

const validBuffers = []
const validSizes = []
for (let i = 0; i < sizes.length; i++) {
  if (pngBuffers[i]) {
    validBuffers.push(pngBuffers[i])
    validSizes.push(sizes[i])
  }
}

const imageCount = validBuffers.length
const headerSize = 6
const dirEntrySize = 16
const dirSize = imageCount * dirEntrySize

const imageOffsets = []
let offset = headerSize + dirSize
for (let i = 0; i < imageCount; i++) {
  imageOffsets.push(offset)
  offset += validBuffers[i].length
}

const header = Buffer.alloc(headerSize)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(imageCount, 4)

const dir = Buffer.alloc(dirSize)
for (let i = 0; i < imageCount; i++) {
  const pos = i * dirEntrySize
  const w = validSizes[i] >= 256 ? 0 : validSizes[i]
  const h = validSizes[i] >= 256 ? 0 : validSizes[i]
  dir.writeUInt8(w, pos)
  dir.writeUInt8(h, pos + 1)
  dir.writeUInt8(0, pos + 2)
  dir.writeUInt8(0, pos + 3)
  dir.writeUInt16LE(1, pos + 4)
  dir.writeUInt16LE(32, pos + 6)
  dir.writeUInt32LE(validBuffers[i].length, pos + 8)
  dir.writeUInt32LE(imageOffsets[i], pos + 12)
}

const ico = Buffer.concat([header, dir, ...validBuffers])
writeFileSync(resolve(iconsDir, 'icon.ico'), ico)

console.log('icon.ico generated successfully!')
console.log(`  format: ICO 3.0`)
console.log(`  images: ${validSizes.join(', ')}`)
console.log(`  total size: ${ico.length} bytes`)