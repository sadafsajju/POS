// Publish a Tauri update to Vercel Blob.
//
// Reads the signed installer + .sig from the NSIS bundle output, uploads them
// to Vercel Blob, builds a latest.json that points at the public Blob URL, and
// uploads that too. The Tauri updater inside the installed app polls
// `<blob>/latest.json` and downloads the .exe from the URL listed there.
//
// Required env:
//   BLOB_READ_WRITE_TOKEN  Vercel Blob token (vercel_blob_rw_...)
//   APP_VERSION            Version being released (e.g. "0.1.0")
//
// Optional env:
//   RELEASE_NOTES          Plain text shown in the in-app update dialog
//   BUNDLE_DIR             Override default bundle directory

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
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

const bundleDir =
  process.env.BUNDLE_DIR ??
  resolve(
    'apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis',
  )

if (!existsSync(bundleDir)) {
  console.error(`Bundle directory not found: ${bundleDir}`)
  process.exit(1)
}

const files = readdirSync(bundleDir)
const exeName = files.find((f) => f.endsWith('.exe'))
const sigName = files.find((f) => f.endsWith('.exe.sig'))

if (!exeName || !sigName) {
  console.error(`Missing installer or signature in ${bundleDir}`)
  console.error(`Files: ${files.join(', ')}`)
  process.exit(1)
}

const exePath = resolve(bundleDir, exeName)
const sigPath = resolve(bundleDir, sigName)
const exeBuffer = readFileSync(exePath)
const signature = readFileSync(sigPath, 'utf8').trim()

console.log(`Uploading ${exeName} (${exeBuffer.length} bytes) to Vercel Blob…`)

const exeBlob = await put(`windows/v${version}/${exeName}`, exeBuffer, {
  access: 'public',
  token,
  contentType: 'application/octet-stream',
  addRandomSuffix: false,
  allowOverwrite: true,
})

console.log(`Installer URL: ${exeBlob.url}`)

const manifest = {
  version,
  notes: process.env.RELEASE_NOTES ?? '',
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: exeBlob.url,
    },
  },
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

console.log(`Manifest URL: ${manifestBlob.url}`)
console.log('\nDone. Configure tauri.conf.json plugins.updater.endpoints to:')
console.log(`  ${manifestBlob.url}`)
