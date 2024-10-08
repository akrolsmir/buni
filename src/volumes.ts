import { write, file, Glob } from 'bun'
import { Database } from 'bun:sqlite'
import { join } from 'path'
import { rm } from 'fs/promises'

const isDeployed = !!process.env.FLY_IO || !!process.env.RENDER
const VOLUME_PATH = isDeployed ? '/app/codegen' : './codegen'

export function vpath(filename: string) {
  return join(VOLUME_PATH, filename)
}

export async function writeToVolume(filename: string, content: string) {
  await write(vpath(filename), content)
}

export async function readFromVolume(filename: string) {
  return await file(vpath(filename)).text()
}

export function listVolume() {
  const glob = new Glob('**/*')
  const files = []
  for (const file of glob.scanSync(VOLUME_PATH)) {
    files.push(file)
  }
  return files
}

export async function syncToVolume(localDir: string) {
  const files = await listVolume()
  for (const f of files) {
    const localPath = join(localDir, f)
    const content = await file(localPath).text()
    await writeToVolume(f, content)
  }
}

export async function syncFromVolume(localDir: string) {
  const files = await listVolume()
  for (const f of files) {
    const content = await readFromVolume(f)
    const localPath = join(localDir, f)
    await write(localPath, content)
  }
}

export function getVolumePath() {
  return VOLUME_PATH
}

// Get the sqlite db like 'foo/db.sqlite'
export function dbOnVolume(filename: string) {
  return new Database(vpath(filename), { create: true })
}

export async function deleteFromVolume(folderName: string) {
  await rm(vpath(folderName), { recursive: true, force: true })
}
