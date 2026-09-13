import {cp, mkdir, rm} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = [
  {
    name: '8th Wall Engine',
    source: path.join(projectRoot, 'node_modules', '@8thwall', 'engine-binary', 'dist'),
    destination: path.join(projectRoot, 'public', 'external', 'xr'),
  },
  {
    name: 'XRExtras',
    source: path.join(projectRoot, 'node_modules', '@8thwall', 'xrextras', 'dist'),
    destination: path.join(projectRoot, 'public', 'external', 'xrextras'),
  },
]

for (const artifact of artifacts) {
  await mkdir(path.dirname(artifact.destination), {recursive: true})
  await rm(artifact.destination, {recursive: true, force: true})
  await cp(artifact.source, artifact.destination, {recursive: true})
  console.log(`Copied ${artifact.name} artifacts to ${artifact.destination}`)
}
