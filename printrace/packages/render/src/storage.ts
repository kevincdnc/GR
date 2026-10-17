import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

/** Stockage des fichiers produits (disque local ; S3/R2 en production). */
export interface FileStorage {
  put(key: string, data: Uint8Array, mime: string): Promise<void>
  get(key: string): Promise<Uint8Array>
}

export class LocalStorage implements FileStorage {
  private root: string
  constructor(root: string) {
    this.root = resolve(root)
  }
  private path(key: string) {
    const p = resolve(join(this.root, key))
    if (!p.startsWith(this.root)) throw new Error('clé invalide')
    return p
  }
  async put(key: string, data: Uint8Array) {
    const p = this.path(key)
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, data)
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.path(key)))
  }
}
