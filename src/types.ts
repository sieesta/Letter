export interface MemoryPhoto {
  id: string
  src: string
  caption: string
  date: string
}

export interface MuseumProfile {
  id: string
  userId?: string
  /** Unique slug used for the public share URL: /m/<slug> */
  slug: string
  herName: string
  hallTitle: string
  message: string
  youtubeUrl: string
  /** Supabase storage path of the uploaded audio file, when one was uploaded */
  audioKey: string
  audioFileName: string
  formLink: string
  photos: MemoryPhoto[]
  updatedAt: number
}

export const EMPTY_PROFILE: MuseumProfile = {
  id: '',
  slug: '',
  herName: '',
  hallTitle: 'A Hallway of Us',
  message: '',
  youtubeUrl: '',
  audioKey: '',
  audioFileName: '',
  formLink: '',
  photos: [],
  updatedAt: 0,
}

export type MusicStatus =
  | 'idle'
  | 'arming'
  | 'resolving'
  | 'downloading'
  | 'playing'
  | 'paused'
  | 'blocked'
  | 'error'
  | 'none'

export type MusicSource = 'none' | 'cache' | 'stream' | 'file' | 'embed' | 'url'

export interface MusicState {
  status: MusicStatus
  source: MusicSource
  /** 0..1 of the audio payload fetched so far */
  downloadProgress: number
  /** 0..1 of the track played */
  progress: number
  duration: number
  title: string
  error: string | null
}
