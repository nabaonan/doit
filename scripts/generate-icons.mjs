import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = resolve(__dirname, '..', 'src-tauri', 'icons')
const iconsetDir = resolve(__dirname, '..', 'src-tauri', 'icons', 'doit.iconset')

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#34D399"/>
      <stop offset="100%" style="stop-color:#10B981"/>
    </linearGradient>
    <linearGradient id="bgDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#059669"/>
      <stop offset="100%" style="stop-color:#047857"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:0.35"/>
      <stop offset="100%" style="stop-color:#FFFFFF;stop-opacity:0"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#000000" flood-opacity="0.18"/>
    </filter>
    <clipPath id="clip">
      <rect x="88" y="88" width="848" height="848" rx="208" ry="208"/>
    </clipPath>
  </defs>

  <rect x="64" y="64" width="896" height="896" rx="224" ry="224" fill="url(#bg)" filter="url(#shadow)"/>

  <rect x="72" y="72" width="880" height="880" rx="216" ry="216" fill="url(#bgDark)"/>

  <rect x="88" y="88" width="848" height="848" rx="208" ry="208" fill="url(#bg)"/>

  <g clip-path="url(#clip)">
    <rect x="88" y="88" width="848" height="340" fill="url(#gloss)"/>
  </g>

  <path d="M260 530 L430 690 L760 350"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="80"
        stroke-linecap="round"
        stroke-linejoin="round"/>
</svg>`

const sizes = {
  'icon_16x16.png': 16,
  'icon_16x16@2x.png': 32,
  'icon_32x32.png': 32,
  'icon_32x32@2x.png': 64,
  'icon_128x128.png': 128,
  'icon_128x128@2x.png': 256,
  'icon_256x256.png': 256,
  'icon_256x256@2x.png': 512,
  'icon_512x512.png': 512,
  'icon_512x512@2x.png': 1024,
}

const finalFiles = {
  '32x32.png': 32,
  '128x128.png': 128,
  '128x128@2x.png': 256,
}

async function run() {
  const { default: sharp } = await import('sharp')

  const svgBuffer = Buffer.from(svgContent)

  console.log('Creating iconset...')
  if (existsSync(iconsetDir)) rmSync(iconsetDir, { recursive: true })
  mkdirSync(iconsetDir, { recursive: true })

  for (const [filename, size] of Object.entries(sizes)) {
    const filepath = resolve(iconsetDir, filename)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(filepath)
    console.log(`  ${filename} (${size}x${size})`)
  }

  console.log('Generating icon.icns with iconutil...')
  execSync(`iconutil -c icns "${iconsetDir}" -o "${resolve(iconsDir, 'icon.icns')}"`)

  console.log('Generating PNGs for tauri config...')
  for (const [filename, size] of Object.entries(finalFiles)) {
    const filepath = resolve(iconsDir, filename)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(filepath)
    console.log(`  ${filename} (${size}x${size})`)
  }

  console.log('Generating icon.ico...')
  const icoBuffer = await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toBuffer()
  writeFileSync(resolve(iconsDir, 'icon.ico'), icoBuffer)

  console.log('Cleaning up iconset...')
  rmSync(iconsetDir, { recursive: true })

  console.log('Done! All icons generated.')
}

run().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})