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
import { put, list, del } from '@vercel/blob'

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

/** Parse the version out of a `windows/vX.Y.Z/...` or `macos/vX.Y.Z/...` path. */
function versionOfPath(pathname) {
  const m = pathname.match(/^(?:windows|macos)\/v(\d+\.\d+\.\d+)\//)
  return m ? m[1] : null
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

async function listAll(prefix) {
  const out = []
  let cursor
  do {
    const res = await list({ prefix, cursor, token })
    out.push(...res.blobs)
    cursor = res.cursor
  } while (cursor)
  return out
}

/**
 * Delete installer artifacts from older releases, keeping the version being
 * published plus the single most recent previous version (so an in-flight
 * update still has a valid target). Without this the Vercel Blob store grows
 * unbounded and eventually exceeds its quota, breaking publishes.
 */
async function pruneOldVersions(keepVersion) {
  const all = [...(await listAll('windows/')), ...(await listAll('macos/'))]
  const versions = [...new Set(all.map((b) => versionOfPath(b.pathname)).filter(Boolean))]
  const previous = versions
    .filter((v) => v !== keepVersion)
    .sort(compareVersions)
    .pop() // highest remaining = the current live version
  const keep = new Set([keepVersion, previous].filter(Boolean))
  const toDelete = all
    .filter((b) => {
      const v = versionOfPath(b.pathname)
      return v && !keep.has(v)
    })
    .map((b) => b.url)
  if (toDelete.length === 0) {
    console.log('Prune: nothing to delete (keeping', [...keep].join(', '), ')')
    return
  }
  console.log(`Prune: deleting ${toDelete.length} blobs from old versions (keeping ${[...keep].join(', ')})`)
  // del() accepts up to 1000 URLs per call.
  for (let i = 0; i < toDelete.length; i += 1000) {
    await del(toDelete.slice(i, i + 1000), { token })
  }
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

// Free space first — the Blob store is quota-limited, and each release adds
// ~100 MB of installers. Prune old versions before uploading the new ones.
await pruneOldVersions(version)

const platforms = {}

// Direct, user-facing fresh-install download URLs (NOT used by the updater).
// Surfaced so download pages can link the real installer without reconstructing
// filenames. Windows: the NSIS .exe (same file the updater uses). macOS: the .dmg.
const downloads = {}

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
  // but we publish it under the same versioned path and expose its URL in the
  // manifest so download pages can link it directly (no filename guessing).
  if (macDmg) {
    downloads['macos'] = await uploadFile(
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

/**
 * Pull a short, user-facing release note out of the raw commit message.
 *
 * The in-app update dialog should show a single human-readable sentence,
 * not the full conventional-commit body (with type prefix, body, footers,
 * Co-Authored-By lines, …). So we:
 *   1. Take the first non-blank line of the commit message.
 *   2. Strip the "type(scope): " prefix (feat:, fix:, chore:, …).
 *   3. Strip any trailing " (v0.1.X)" version tag — that's redundant with
 *      the manifest's `version` field.
 *   4. Capitalise the first letter so it reads like a headline.
 * Override by passing a hand-written `RELEASE_NOTES_OVERRIDE` if needed.
 */
function cleanReleaseNotes(raw) {
  if (!raw) return ''
  const firstLine = raw.split('\n').map((s) => s.trim()).find(Boolean) ?? ''
  const cleaned = firstLine
    .replace(/^[a-z]+(\([^)]+\))?: ?/, '')
    .replace(/\s*\(v[0-9.]+\)\s*$/, '')
    .trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

const releaseNotes =
  process.env.RELEASE_NOTES_OVERRIDE ?? cleanReleaseNotes(process.env.RELEASE_NOTES)

const manifest = {
  version,
  notes: releaseNotes,
  pub_date: new Date().toISOString(),
  platforms,
  downloads,
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
