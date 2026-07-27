// Verify TTF name table. Run: bun run scripts/verify-font-name.ts <path-to-font.ttf>
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readTag(buf, off) {
  return String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3])
}

function parseNameTable(buf) {
  const numTables = buf.readUInt16BE(4)
  let nameOffset = 0
  for (let i = 0; i < numTables; i++) {
    const entry = 12 + i * 16
    const tag = readTag(buf, entry)
    if (tag === 'name') {
      nameOffset = buf.readUInt32BE(entry + 8)
      break
    }
  }
  if (!nameOffset) return null
  const count = buf.readUInt16BE(nameOffset + 2)
  const stringOffset = buf.readUInt16BE(nameOffset + 4)
  const results = {}
  for (let i = 0; i < count; i++) {
    const rec = nameOffset + 6 + i * 12
    const platformID = buf.readUInt16BE(rec)
    const encodingID = buf.readUInt16BE(rec + 2)
    const nameID = buf.readUInt16BE(rec + 6)
    const length = buf.readUInt16BE(rec + 8)
    const offset = buf.readUInt16BE(rec + 10)
    const strStart = nameOffset + stringOffset + offset
    const slice = buf.slice(strStart, strStart + length)
    let str
    if (platformID === 3 && encodingID === 1) {
      str = slice.swap16().toString('utf16le')
    } else if (platformID === 0) {
      str = slice.toString('latin1')
    } else {
      continue
    }
    if (!results[nameID]) results[nameID] = str
  }
  return results
}

function readU16(buf, off) {
  return buf.readUInt16BE(off)
}
function readU32(buf, off) {
  return buf.readUInt32BE(off)
}

function getTableInfo(buf) {
  const numTables = readU16(buf, 4)
  const info = {}
  for (let i = 0; i < numTables; i++) {
    const entry = 12 + i * 16
    const tag = readTag(buf, entry)
    if (tag === 'maxp') {
      const off = readU32(buf, entry + 8)
      info.numGlyphs = readU16(buf, off + 4)
    }
    if (tag === 'OS/2') {
      const off = readU32(buf, entry + 8)
      info.usWeightClass = readU16(buf, off + 4)
    }
    if (tag === 'head') {
      const off = readU32(buf, entry + 8)
      info.unitsPerEm = readU16(buf, off + 18)
    }
  }
  return info
}

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: bun run scripts/verify-font-name.ts <path-to-font.ttf>')
  process.exit(1)
}

const path = resolve(arg)
const buf = readFileSync(path)
const names = parseNameTable(buf)
const info = getTableInfo(buf)

console.log('File:', path)
console.log('  numGlyphs:        ', info.numGlyphs)
console.log('  usWeightClass:    ', info.usWeightClass)
console.log('  unitsPerEm:       ', info.unitsPerEm)
console.log('  nameID 1 (Family):', names?.[1] ?? 'n/a')
console.log('  nameID 2 (Sub):   ', names?.[2] ?? 'n/a')
console.log('  nameID 16 (TyFam):', names?.[16] ?? 'n/a')
console.log('  nameID 17 (TySub):', names?.[17] ?? 'n/a')
