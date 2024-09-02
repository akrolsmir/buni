import { write, file, Glob } from 'bun'
import { join } from 'path'

const isFlySafe = !!process.env.FLY_IO
const VOLUME_PATH = isFlySafe ? '/app/codegen' : './codegen'

export async function writeToVolume(filename: string, content: string) {
  const path = join(VOLUME_PATH, filename)
  await write(path, content)
}

export async function readFromVolume(filename: string) {
  const path = join(VOLUME_PATH, filename)
  return await file(path).text()
}

export async function listVolume() {
  const glob = new Glob('**/*')
  const files = []
  for await (const file of glob.scan(VOLUME_PATH)) {
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
