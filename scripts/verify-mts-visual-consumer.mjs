import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const projectRoot = resolve(process.cwd())
const lockPath = join(projectRoot, 'contracts/mts-visual-consumer-lock.json')
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))

const expectedLock = {
  schema: 'aprover-mts-visual-consumer-lock/v0.1',
  channel: 'accepted-presentation',
  repository: 'netkeep80/mts_visual',
  commit: '2d76cd29143fa764f4a08d0c0a788ff73c38841c',
  package: {
    root: '.',
    name: '@mts/visual',
    version: '0.2.0',
    private: true,
    manifest: {
      path: 'package.json',
      gitBlobSha: 'f17a2e119cd1e98110b5a36baa8535a435a03ac1',
    },
    lockfile: {
      path: 'package-lock.json',
      gitBlobSha: '3446bedebbd0bbc00b676f97050083d17f02107b',
      lockfileVersion: 3,
    },
    dependencies: {
      three: '0.185.1',
    },
  },
  authority: {
    floatingRefAllowed: false,
    deepSourceImportAllowed: false,
    semanticAcceptanceClaimed: false,
    semanticCoreLockIndependent: true,
  },
}
assert.deepEqual(lock, expectedLock, 'visual consumer lock must match accepted authority exactly')

const projectManifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
const projectDependencies = {
  ...(projectManifest.dependencies ?? {}),
  ...(projectManifest.devDependencies ?? {}),
  ...(projectManifest.peerDependencies ?? {}),
  ...(projectManifest.optionalDependencies ?? {}),
}
assert.equal(
  Object.hasOwn(projectDependencies, '@mts/visual'),
  false,
  '@mts/visual must remain absent from aprover application dependencies in A1',
)

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

const scratch = mkdtempSync(join(tmpdir(), 'aprover-mts-visual-'))
const source = join(scratch, 'mts_visual')
const artifacts = join(scratch, 'artifacts')
const consumer = join(scratch, 'consumer')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

try {
  run('git', ['init', '--quiet', source], scratch)
  run('git', ['-C', source, 'remote', 'add', 'origin', `https://github.com/${lock.repository}.git`], scratch)
  run('git', ['-C', source, 'fetch', '--quiet', '--depth=1', 'origin', lock.commit], scratch)
  run('git', ['-C', source, 'checkout', '--quiet', '--detach', 'FETCH_HEAD'], scratch)
  assert.equal(run('git', ['-C', source, 'rev-parse', 'HEAD'], scratch), lock.commit)

  const packageRoot = resolve(source, lock.package.root)
  const manifestPath = join(packageRoot, lock.package.manifest.path)
  const packageLockPath = join(packageRoot, lock.package.lockfile.path)

  assert.equal(
    run('git', ['-C', source, 'hash-object', lock.package.manifest.path], scratch),
    lock.package.manifest.gitBlobSha,
    'package.json Git blob must match visual consumer lock',
  )
  assert.equal(
    run('git', ['-C', source, 'hash-object', lock.package.lockfile.path], scratch),
    lock.package.lockfile.gitBlobSha,
    'package-lock.json Git blob must match visual consumer lock',
  )

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'))
  const rootLock = packageLock.packages?.['']

  assert.equal(manifest.name, lock.package.name)
  assert.equal(manifest.version, lock.package.version)
  assert.equal(manifest.private, lock.package.private)
  assert.equal(manifest.dependencies?.three, lock.package.dependencies.three)
  assert.equal(manifest.devDependencies?.typescript, '5.9.3')
  assert.equal(packageLock.name, lock.package.name)
  assert.equal(packageLock.version, lock.package.version)
  assert.equal(packageLock.lockfileVersion, lock.package.lockfile.lockfileVersion)
  assert.equal(rootLock?.name, lock.package.name)
  assert.equal(rootLock?.version, lock.package.version)
  assert.equal(rootLock?.dependencies?.three, lock.package.dependencies.three)
  assert.equal(rootLock?.devDependencies?.typescript, '5.9.3')

  run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], packageRoot)
  run(npm, ['run', 'build', '--silent'], packageRoot)

  mkdirSync(artifacts)
  const packed = JSON.parse(
    run(npm, ['pack', '--json', '--pack-destination', artifacts], packageRoot),
  )
  assert.equal(packed.length, 1, 'npm pack must emit exactly one @mts/visual artifact')
  const artifact = join(artifacts, packed[0].filename)

  mkdirSync(consumer)
  writeFileSync(
    join(consumer, 'package.json'),
    `${JSON.stringify(
      {
        name: 'aprover-mts-visual-consumer-smoke',
        private: true,
        type: 'module',
        dependencies: {
          '@mts/visual': `file:${artifact}`,
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  run(
    npm,
    ['install', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'],
    consumer,
  )

  writeFileSync(
    join(consumer, 'smoke.mjs'),
    [
      "import assert from 'node:assert/strict'",
      "import { createInitialPhysics3DState, createLivePhysics3D } from '@mts/visual'",
      "assert.equal(typeof createInitialPhysics3DState, 'function')",
      "assert.equal(typeof createLivePhysics3D, 'function')",
      'let deepImportRejected = false',
      'try {',
      "  await import('@mts/visual/dist/src/physics3d.js')",
      '} catch (error) {',
      "  deepImportRejected = error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'",
      '}',
      "assert.equal(deepImportRejected, true, 'deep source import must fail closed')",
      '',
    ].join('\n'),
    'utf8',
  )
  run(process.execPath, ['smoke.mjs'], consumer)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
