// Assemble the GitHub Release payload.
//
// Reads the platform installers from the Actions artifacts directory, copies
// them into ./release with URL-safe names, and writes ./release/latest.json —
// the Tauri updater manifest — with `url`s pointing at the GitHub Release asset
// download URLs. The workflow then uploads everything in ./release to the
// release for the current tag.
//
// Required env:
//   GH_REPO      "owner/repo" (github.repository)
//   RELEASE_TAG  the tag, e.g. "v0.1.30" (github.ref_name)
// Optional env:
//   APP_VERSION          defaults to RELEASE_TAG; leading "v" is stripped
//   RELEASE_NOTES        raw commit message, distilled into the in-app note
//   ARTIFACTS_DIR        defaults to "artifacts"

import {
  readFileSync, existsSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync,
} from 'node:fs'
import { resolve, join, basename } from 'node:path'

const repo = process.env.GH_REPO
const tag = process.env.RELEASE_TAG
if (!repo || !tag) {
  console.error('GH_REPO and RELEASE_TAG are required')
  process.exit(1)
}
const version = (process.env.APP_VERSION || tag).replace(/^v/, '')

const artifactsDir = resolve(process.env.ARTIFACTS_DIR ?? 'artifacts')
if (!existsSync(artifactsDir)) {
  console.error(`Artifacts directory not found: ${artifactsDir}`)
  process.exit(1)
}

const outDir = resolve('release')
mkdirSync(outDir, { recursive: true })

function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...walk(full))
    else if (s.isFile()) out.push(full)
  }
  return out
}

function findFile(dir, predicate) {
  const matches = walk(dir).filter((p) => predicate(basename(p)))
  if (matches.length === 0) return undefined
  if (matches.length > 1) throw new Error(`Ambiguous match in ${dir}: ${matches.join(', ')}`)
  return matches[0]
}

// GitHub replaces spaces in asset names; normalise up front so the download
// URLs we bake into the manifest are deterministic.
const safeName = (name) => name.replace(/\s+/g, '.')
const ghUrl = (assetName) => `https://github.com/${repo}/releases/download/${tag}/${assetName}`

function placeAsset(srcPath) {
  const name = safeName(basename(srcPath))
  copyFileSync(srcPath, join(outDir, name))
  return ghUrl(name)
}

const platforms = {}
const downloads = {}

// ── Windows ─────────────────────────────────────────────────────────────────
const winDir = join(artifactsDir, 'windows')
const winExe = findFile(winDir, (n) => n.endsWith('.exe'))
const winSig = findFile(winDir, (n) => n.endsWith('.exe.sig'))
if (winExe && winSig) {
  const url = placeAsset(winExe)
  platforms['windows-x86_64'] = { signature: readFileSync(winSig, 'utf8').trim(), url }
  downloads['windows'] = url
} else {
  console.log('No Windows artifacts found, skipping windows-x86_64')
}

// ── macOS (universal, served to both architectures) ─────────────────────────
const macDir = join(artifactsDir, 'macos')
const macTar = findFile(macDir, (n) => n.endsWith('.app.tar.gz'))
const macSig = findFile(macDir, (n) => n.endsWith('.app.tar.gz.sig'))
const macDmg = findFile(macDir, (n) => n.endsWith('.dmg'))
if (macTar && macSig) {
  const entry = { signature: readFileSync(macSig, 'utf8').trim(), url: placeAsset(macTar) }
  platforms['darwin-x86_64'] = entry
  platforms['darwin-aarch64'] = entry
  if (macDmg) downloads['macos'] = placeAsset(macDmg)
} else {
  console.log('No macOS artifacts found, skipping darwin platforms')
}

if (Object.keys(platforms).length === 0) {
  console.error('No platforms produced — refusing to publish an empty manifest')
  process.exit(1)
}

function cleanReleaseNotes(raw) {
  if (!raw) return ''
  const firstLine = raw.split('\n').map((s) => s.trim()).find(Boolean) ?? ''
  const cleaned = firstLine
    .replace(/^[a-z]+(\([^)]+\))?: ?/, '')
    .replace(/\s*\(v[0-9.]+\)\s*$/, '')
    .trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

const manifest = {
  version,
  notes: process.env.RELEASE_NOTES_OVERRIDE ?? cleanReleaseNotes(process.env.RELEASE_NOTES),
  pub_date: new Date().toISOString(),
  platforms,
  downloads,
}

writeFileSync(join(outDir, 'latest.json'), JSON.stringify(manifest, null, 2))
console.log('release/ contents:', readdirSync(outDir).join(', '))
console.log('platforms:', Object.keys(platforms).join(', '))
console.log('downloads:', Object.keys(downloads).join(', '))
