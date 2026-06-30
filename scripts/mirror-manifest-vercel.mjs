// Transition shim — mirror the freshly built latest.json to the legacy Vercel
// Blob location.
//
// Already-installed devices only know the old Vercel updater endpoint, so until
// they update onto a build that carries the GitHub endpoint they still poll
// Vercel. This overwrites the tiny latest.json (which now points at GitHub-hosted
// installers) — no new storage, so it succeeds even though the Blob store is over
// quota with legacy installers. It also best-effort deletes those legacy
// installer blobs, since installers now live on GitHub Releases.
//
// Entirely best-effort: a failure here must NOT fail the release (GitHub is the
// source of truth). Remove this once every device reports a GitHub-endpoint
// version (see the app_clients table).

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { put, list, del } from '@vercel/blob'

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) {
  console.log('No BLOB_READ_WRITE_TOKEN set — skipping Vercel mirror')
  process.exit(0)
}

const manifestPath = resolve('release/latest.json')
if (!existsSync(manifestPath)) {
  console.log('release/latest.json not found — skipping Vercel mirror')
  process.exit(0)
}

try {
  const body = readFileSync(manifestPath, 'utf8')
  const res = await put('latest.json', body, {
    access: 'public',
    token,
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  })
  console.log('Mirrored latest.json to Vercel:', res.url)
} catch (e) {
  console.log('Vercel latest.json mirror failed (non-fatal):', e?.message)
}

// Installers now live on GitHub Releases, so the legacy Vercel installer blobs
// are dead weight keeping the store at quota. Best-effort cleanup.
try {
  let deleted = 0
  for (const prefix of ['windows/', 'macos/']) {
    let cursor
    do {
      const r = await list({ prefix, cursor, token })
      const urls = r.blobs.map((b) => b.url)
      if (urls.length) {
        await del(urls, { token })
        deleted += urls.length
      }
      cursor = r.cursor
    } while (cursor)
  }
  if (deleted) console.log(`Pruned ${deleted} legacy installer blobs from Vercel`)
} catch (e) {
  console.log('Legacy Vercel prune skipped (non-fatal):', e?.message)
}
