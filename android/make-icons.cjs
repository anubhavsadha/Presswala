// Renders res/mipmap-*/ic_launcher.png from ../public/icon.svg using the preinstalled Chromium.
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const svg = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8')
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage()
  for (const [d, px] of Object.entries(sizes)) {
    await p.setViewportSize({ width: px, height: px })
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body></html>`)
    const dir = path.join(__dirname, 'res', 'mipmap-' + d)
    fs.mkdirSync(dir, { recursive: true })
    await p.screenshot({ path: path.join(dir, 'ic_launcher.png'), omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } })
  }
  await b.close()
})()
