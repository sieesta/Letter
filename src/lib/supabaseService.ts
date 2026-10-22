/**
 * App-specific Supabase helpers.
 *
 * Profiles are owned by an anonymous auth user. Each profile gets a unique
 * slug that becomes its public share URL: /m/<slug>
 */

import type { MemoryPhoto, MuseumProfile } from '../types'
import { EMPTY_PROFILE } from '../types'
import { supabase } from './supabase'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'memory-lane'
}

export function makeSlug(herName: string, hallTitle: string): string {
  const base = slugify(herName || hallTitle || 'memory-lane')
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

export interface ProfileRow {
  id: string
  user_id: string
  slug: string
  her_name: string | null
  hall_title: string | null
  message: string | null
  youtube_url: string | null
  audio_path: string | null
  audio_file_name: string | null
  form_link: string | null
  created_at: string
  updated_at: string
}

export interface PhotoRow {
  id: string
  profile_id: string
  storage_path: string
  caption: string | null
  date: string | null
  sort_order: number
  created_at: string
}

function rowToProfile(row: ProfileRow, photos: PhotoRow[]): MuseumProfile {
  return {
    id: row.id,
    slug: row.slug,
    userId: row.user_id,
    herName: row.her_name ?? '',
    hallTitle: row.hall_title ?? EMPTY_PROFILE.hallTitle,
    message: row.message ?? '',
    youtubeUrl: row.youtube_url ?? '',
    audioKey: row.audio_path ?? '',
    audioFileName: row.audio_file_name ?? '',
    formLink: row.form_link ?? '',
    photos: photos
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((photo) => ({
        id: photo.id,
        src: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${photo.storage_path}`,
        caption: photo.caption ?? '',
        date: photo.date ?? '',
      })),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

/** Sign in anonymously (no email/password). Returns the user id. */
export async function signInAnonymously(): Promise<string> {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (!data?.user?.id) throw new Error('Anonymous sign-in returned no user')
  return data.user.id
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user?.id ?? null
}

export async function saveProfile(
  userId: string,
  profile: MuseumProfile & { slug?: string },
): Promise<{ slug: string; id: string } | null> {
  const slug = profile.slug || makeSlug(profile.herName, profile.hallTitle)
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      slug,
      her_name: profile.herName || null,
      hall_title: profile.hallTitle || null,
      message: profile.message || null,
      youtube_url: profile.youtubeUrl || null,
      audio_path: profile.audioKey || null,
      audio_file_name: profile.audioFileName || null,
      form_link: profile.formLink || null,
    })
    .select()
    .single()

  if (error) {
    // slug may be taken — retry with a fresh suffix
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return saveProfile(userId, { ...profile, slug: makeSlug(profile.herName, profile.hallTitle) })
    }
    throw error
  }

  const created = data as { id: string; slug: string } | null
  if (!created) return null

  if (profile.photos.length) {
    await supabase.from('photos').insert(
      profile.photos.map((photo, index) => ({
        profile_id: created.id,
        storage_path: '', // filled after upload
        caption: photo.caption || null,
        date: photo.date || null,
        sort_order: index,
      })),
    )
  }

  return { slug: created.slug, id: created.id }
}

export async function updateProfile(
  userId: string,
  profileId: string,
  patch: Partial<MuseumProfile>,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      her_name: patch.herName !== undefined ? patch.herName : undefined,
      hall_title: patch.hallTitle !== undefined ? patch.hallTitle : undefined,
      message: patch.message !== undefined ? patch.message : undefined,
      youtube_url: patch.youtubeUrl !== undefined ? patch.youtubeUrl : undefined,
      audio_path: patch.audioKey !== undefined ? patch.audioKey : undefined,
      audio_file_name: patch.audioFileName !== undefined ? patch.audioFileName : undefined,
      form_link: patch.formLink !== undefined ? patch.formLink : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function loadProfileBySlug(slug: string): Promise<MuseumProfile | null> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !profiles) return null

  if (error || !profiles) return null

  const row = (profiles as unknown) as ProfileRow
  if (!row) return null

  const { data: photos, error: photoError } = await supabase
    .from('photos')
    .select('*')
    .eq('profile_id', row.id)
    .order('sort_order', { ascending: true })

  if (photoError) return null

  return rowToProfile(row, (photos as PhotoRow[]) ?? [])
}

export async function loadProfilesForUser(userId: string): Promise<MuseumProfile[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !profiles) return []

  const rows = profiles as ProfileRow[]
  const result: MuseumProfile[] = []
  for (const row of rows) {
    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .eq('profile_id', row.id)
      .order('sort_order', { ascending: true })
    result.push(rowToProfile(row, (photos as PhotoRow[]) ?? []))
  }
  return result
}

export async function uploadPhoto(
  userId: string,
  profileId: string,
  file: File,
): Promise<{ path: string; publicUrl: string } | null> {
  const path = `${userId}/${profileId}/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`
  const { data, error } = await supabase.storage.from('photos').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
  })
  if (error || !data) throw error || new Error('Upload failed')
  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(data.path)
  return { path: data.path, publicUrl: urlData.publicUrl }
}

export async function uploadAudio(
  userId: string,
  profileId: string,
  file: File,
): Promise<{ path: string; publicUrl: string } | null> {
  const path = `${userId}/${profileId}/audio-${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`
  const { data, error } = await supabase.storage.from('audio').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
  })
  if (error || !data) throw error || new Error('Upload failed')
  const { data: urlData } = supabase.storage.from('audio').getPublicUrl(data.path)
  return { path: data.path, publicUrl: urlData.publicUrl }
}

export async function updatePhotos(
  profileId: string,
  photos: MemoryPhoto[],
): Promise<void> {
  await supabase.from('photos').delete().eq('profile_id', profileId)

  if (photos.length) {
    await supabase.from('photos').insert(
      photos.map((photo, index) => ({
        profile_id: profileId,
        storage_path: (photo as { storage_path?: string }).storage_path || '',
        caption: photo.caption || null,
        date: photo.date || null,
        sort_order: index,
      })),
    )
  }
}
