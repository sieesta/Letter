/** Reads a file, downscales it and returns a compact data URL. */
export function readImageAsDataUrl(file: File, maxEdge = 1500, quality = 0.86): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that image'))
    reader.onload = () => {
      const source = reader.result as string
      const image = new Image()
      image.onload = () => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
          const width = Math.max(1, Math.round(image.width * scale))
          const height = Math.max(1, Math.round(image.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d')
          if (!context) {
            resolve(source)
            return
          }
          context.drawImage(image, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch {
          resolve(source)
        }
      }
      image.onerror = () => resolve(source)
      image.src = source
    }
    reader.readAsDataURL(file)
  })
}

/** Reads any audio file into a Blob, ready for IndexedDB. */
export function readFileAsBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that audio file'))
    reader.onload = () => resolve(reader.result as unknown as Blob)
    reader.readAsArrayBuffer(file)
  })
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}
