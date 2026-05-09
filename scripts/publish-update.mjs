// Publish a Tauri update to Vercel Blob.
//
// Walks an artifacts directory laid out by the GitHub Actions workflow,
// uploads the platform installers + update tarballs to versioned Blob paths,
// and writes a single combined latest.json that the in-app updater polls.
//
// Expected artifacts layout (relative to repo root by default):
//   artifacts/windows/
//     POS System_<version>_x64-setup.exe
//     POS System_<version>_x64-setup.exe.sig
//   artifacts/macos/
//     POS System_<version>_universal.app.tar.gz
//     POS System_<version>_universal.app.tar.gz.sig
//     POS System_<version>_universal.dmg            (optional, fresh install)
//
// Required env:
//   BLOB_READ_WRITE_TOKEN  Vercel Blob token (vercel_blob_rw_...)
//   APP_VERSION            Version being released (e.g. "0.1.3")
//
// Optional env:
//   RELEASE_NOTES          Plain text shown in the in-app update dialog
//   ARTIFACTS_DIR          Override default `artifacts` directory

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { put } from '@vercel/blob'

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) {
  console.error('BLOB_READ_WRITE_TOKEN is required')
  process.exit(1)
}

const version = process.env.APP_VERSION
if (!version) {
  console.error('APP_VERSION is required')
  process.exit(1)
}

const artifactsDir = resolve(process.env.ARTIFACTS_DIR ?? 'artifacts')
if (!existsSync(artifactsDir)) {
  console.error(`Artifacts directory not found: ${artifactsDir}`)
  process.exit(1)
}

/**
 * Recursively walk `dir`, returning the full path of every file underneath.
 */
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

/**
 * Find a single file under `dir` (recursively) whose basename matches
 * `predicate`. Returns undefined if no match. If multiple match, throws
 * (we want unambiguous pipeline output).
 */
function findFile(dir, predicate) {
  const matches = walk(dir).filter((p) => predicate(p.split('/').pop() ?? p))
  if (matches.length === 0) return undefined
  if (matches.length > 1) {
    throw new Error(`Ambiguous match in ${dir}: ${matches.join(', ')}`)
  }
  return matches[0]
}

async function uploadFile(blobPath, filePath, contentType) {
  const buffer = readFileSync(filePath)
  console.log(`Uploading ${filePath} → ${blobPath} (${buffer.length} bytes)`)
  const result = await put(blobPath, buffer, {
    access: 'public',
    token,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return result.url
}

const platforms = {}

// ── Windows ─────────────────────────────────────────────────────────────────
const winDir = join(artifactsDir, 'windows')
const winExe = findFile(winDir, (n) => n.endsWith('.exe'))
const winSig = findFile(winDir, (n) => n.endsWith('.exe.sig'))
if (winExe && winSig) {
  const url = await uploadFile(
    `windows/v${version}/${winExe.split('/').pop()}`,
    winExe,
    'application/octet-stream',
  )
  platforms['windows-x86_64'] = {
    signature: readFileSync(winSig, 'utf8').trim(),
    url,
  }
} else {
  console.log('No Windows artifacts found, skipping windows-x86_64')
}

// ── macOS (universal, served to both architectures) ─────────────────────────
const macDir = join(artifactsDir, 'macos')
const macTar = findFile(macDir, (n) => n.endsWith('.app.tar.gz'))
const macSig = findFile(macDir, (n) => n.endsWith('.app.tar.gz.sig'))
const macDmg = findFile(macDir, (n) => n.endsWith('.dmg'))
if (macTar && macSig) {
  const tarUrl = await uploadFile(
    `macos/v${version}/${macTar.split('/').pop()}`,
    macTar,
    'application/gzip',
  )
  const macEntry = {
    signature: readFileSync(macSig, 'utf8').trim(),
    url: tarUrl,
  }
  // Universal binary handles both architectures — same URL for both keys.
  platforms['darwin-x86_64'] = macEntry
  platforms['darwin-aarch64'] = macEntry

  // .dmg is for fresh-install download only — not referenced by the updater,
  // but we publish it under the same versioned path so users have a direct
  // download URL for new installs.
  if (macDmg) {
    await uploadFile(
      `macos/v${version}/${macDmg.split('/').pop()}`,
      macDmg,
      'application/x-apple-diskimage',
    )
  }
} else {
  console.log('No macOS artifacts found, skipping darwin platforms')
}

if (Object.keys(platforms).length === 0) {
  console.error('No platforms produced — refusing to publish an empty manifest')
  process.exit(1)
}

const manifest = {
  version,
  notes: process.env.RELEASE_NOTES ?? '',
  pub_date: new Date().toISOString(),
  platforms,
}

console.log('Uploading latest.json to Vercel Blob…')
const manifestBlob = await put('latest.json', JSON.stringify(manifest, null, 2), {
  access: 'public',
  token,
  contentType: 'application/json',
  addRandomSuffix: false,
  allowOverwrite: true,
  cacheControlMaxAge: 60,
})

console.log(`\nManifest URL: ${manifestBlob.url}`)
console.log('Platforms in manifest:', Object.keys(platforms).join(', '))
