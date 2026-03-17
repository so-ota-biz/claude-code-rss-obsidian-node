export interface StorageProvider {
  writeFile(path: string, content: string | Buffer): Promise<void>
  readFile(path: string): Promise<string>
  ensureDir(path: string): Promise<void>
  exists(path: string): Promise<boolean>
}

export type StorageType = 'local' | 'dropbox'