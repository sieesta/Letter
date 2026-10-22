/**
 * Minimal Supabase REST client built on fetch. npm registry is unreachable in
 * this environment so @supabase/supabase-js cannot be installed.
 *
 * Surface we actually use:
 *   supabase.auth.signInAnonymously()
 *   supabase.auth.getUser()
 *   supabase.auth.onAuthStateChange(cb)
 *   supabase.from('table').insert / select / update / eq / order / single
 *   supabase.storage.from('bucket').upload / getPublicUrl / remove
 */

export interface SupabaseClient {
  auth: {
    signInAnonymously: () => Promise<{ data: { user: { id: string } | null; session: { access_token: string } | null } | null; error: Error | null }>
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: Error | null }>
    onAuthStateChange: (cb: (event: string, session: { access_token: string } | null) => void) => { data: { subscription: { unsubscribe: () => void } } }
  }
  from: (table: string) => SupabaseQuery
  storage: {
    from: (bucket: string) => SupabaseStorage
  }
}

export interface SupabaseQuery {
  select: (columns?: string) => SupabaseQuery
  insert: (record: any) => SupabaseQuery
  update: (record: any) => SupabaseQuery
  delete: () => SupabaseQuery
  eq: (column: string, value: any) => SupabaseQuery
  order: (column: string, opts?: { ascending?: boolean }) => SupabaseQuery
  single: () => SupabaseQuery
  then: (onFulfilled: (result: { data: any[] | null; error: Error | null }) => void) => Promise<{ data: any[] | null; error: Error | null }>
}

export interface SupabaseStorage {
  upload: (path: string, file: File, opts?: { cacheControl?: string; contentType?: string }) => Promise<{ data: { path: string } | null; error: Error | null }>
  getPublicUrl: (path: string) => { data: { publicUrl: string } }
  remove: (paths: string[]) => Promise<{ error: Error | null }>
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — Supabase calls will fail')
}

function authHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
  }
}

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: any[] | null; error: Error | null }> {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      let message = `Supabase error ${response.status}`
      try {
        const json = await response.json()
        message = json?.error?.message || message
      } catch {
        /* ignore */
      }
      return { data: null, error: new Error(message) }
    }
    const text = await response.text()
    const data = text ? JSON.parse(text) : null
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

function makeQuery(table: string): SupabaseQuery {
  let method = 'GET'
  let body: unknown
  const params: string[] = []
  let single = false

  const base: SupabaseQuery = {
    select: () => base,
    insert: (record: any) => {
      method = 'POST'
      body = record
      return base
    },
    update: (record: any) => {
      method = 'PATCH'
      body = record
      return base
    },
    delete: () => {
      method = 'DELETE'
      return base
    },
    eq: (column: string, value: any) => {
      params.push(`${column}=eq.${encodeURIComponent(String(value))}`)
      return base
    },
    order: (column: string, opts: { ascending?: boolean } = {}) => {
      params.push(`order=${column}.${opts.ascending !== false ? 'asc' : 'desc'}`)
      return base
    },
    single: () => {
      single = true
      return base
    },
    then: (onFulfilled) => {
      const query = params.length ? `?${params.join('&')}` : ''
      const suffix = single ? '.single' : ''
      return request(method, `/${table}${query}${suffix}`, body).then((result) => {
        onFulfilled(result)
        return result
      })
    },
  }
  return base
}

function storageFrom(bucket: string): SupabaseStorage {
  return {
    upload: async (path: string, file: File, opts: { cacheControl?: string; contentType?: string } = {}) => {
      const fullPath = `${bucket}/${path}`
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${fullPath}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
          'Cache-Control': opts.cacheControl || '3600',
          ...(opts.contentType ? { 'Content-Type': opts.contentType } : {}),
        },
        body: file,
      })
      if (!response.ok) {
        let message = `Storage upload failed ${response.status}`
        try {
          const json = await response.json()
          message = json?.error?.message || message
        } catch {
          /* ignore */
        }
        return { data: null, error: new Error(message) }
      }
      return { data: { path: fullPath }, error: null }
    },
    getPublicUrl: (path: string) => {
      const fullPath = `${bucket}/${path}`
      return {
        data: {
          publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${fullPath}`,
        },
      }
    },
    remove: async (paths: string[]) => {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paths),
      })
      if (!response.ok) return { error: new Error(`Storage remove failed ${response.status}`) }
      return { error: null }
    },
  }
}

const state = {
  user: { id: '' } as { id: string } | null,
  session: null as { access_token: string } | null,
}
const listeners = new Set<(event: string, session: { access_token: string } | null) => void>()

function notify(event: string) {
  listeners.forEach((cb) => {
    try { cb(event, state.session) } catch { /* ignore */ }
  })
}

export const supabase: SupabaseClient = {
  auth: {
    signInAnonymously: async () => {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=anonymous`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        return { data: null, error: new Error(`Anonymous sign-in failed ${response.status}`) }
      }
      const json = await response.json()
      state.user = { id: json.user?.id || json.id || '' }
      state.session = { access_token: json.access_token ?? '' }
      notify('SIGNED_IN')
      return { data: { user: state.user, session: state.session }, error: null }
    },
    getUser: async () => {
      return { data: { user: state.user }, error: null }
    },
    onAuthStateChange: (cb) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    },
  },
  from: makeQuery,
  storage: { from: storageFrom },
}
