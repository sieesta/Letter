/**
 * Minimal Supabase REST client built on fetch. npm registry is unreachable in
 * this environment so @supabase/supabase-js cannot be installed.
 *
 * Surface we actually use:
 *   supabase.auth.signUp({ email, password })
 *   supabase.auth.signInWithPassword({ email, password })
 *   supabase.auth.signOut()
 *   supabase.auth.getUser()
 *   supabase.auth.getSession()
 *   supabase.auth.onAuthStateChange(cb)
 *   supabase.from('table').insert / select / update / delete / eq / order / single
 *   supabase.storage.from('bucket').upload / getPublicUrl / remove
 */

export interface SupabaseClient {
  auth: {
    signUp: (credentials: { email: string; password: string }) => Promise<{
      data: { user: { id: string } | null; session: { access_token: string } | null } | null
      error: Error | null
    }>
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
      data: { user: { id: string } | null; session: { access_token: string } | null } | null
      error: Error | null
    }>
    signOut: () => Promise<{ error: Error | null }>
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: Error | null }>
    getSession: () => Promise<{ data: { session: { access_token: string } | null }; error: Error | null }>
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

/** Current session, persisted in localStorage so it survives page reloads. */
let currentSession: { access_token: string } | null = null
/** Current user, persisted in localStorage so it survives page reloads. */
let currentUser: { id: string } | null = null

function loadStoredSession(): { access_token: string } | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('memoryLaneSession')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.access_token) return parsed
    return null
  } catch {
    return null
  }
}

function loadStoredUser(): { id: string } | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('memoryLaneUser')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.id) return parsed
    return null
  } catch {
    return null
  }
}

function storeSession(session: { access_token: string } | null) {
  currentSession = session
  if (typeof localStorage === 'undefined') return
  try {
    if (session) {
      localStorage.setItem('memoryLaneSession', JSON.stringify(session))
    } else {
      localStorage.removeItem('memoryLaneSession')
    }
  } catch {
    /* ignore */
  }
}

function storeUser(user: { id: string } | null) {
  currentUser = user
  if (typeof localStorage === 'undefined') return
  try {
    if (user) {
      localStorage.setItem('memoryLaneUser', JSON.stringify(user))
    } else {
      localStorage.removeItem('memoryLaneUser')
    }
  } catch {
    /* ignore */
  }
}

function authHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${currentSession?.access_token ?? SUPABASE_ANON_KEY ?? ''}`,
  }
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: any[] | null; error: Error | null }> {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  try {
    const response = await fetchWithTimeout(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, 15000)
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
      // .single() is a PostgREST convention for SELECT only, not INSERT/UPDATE/DELETE
      const suffix = single && method === 'GET' ? '.single' : ''
      return request(method, `/${table}${query}${suffix}`, body).then((result) => {
        // For INSERT/UPDATE with return=representation, PostgREST returns array; unwrap if single
        if (single && method !== 'GET' && Array.isArray(result.data) && result.data.length > 0) {
          result.data = result.data[0]
        }
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
      const response = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/object/${fullPath}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${currentSession?.access_token ?? SUPABASE_ANON_KEY ?? ''}`,
          'Cache-Control': opts.cacheControl || '3600',
          ...(opts.contentType ? { 'Content-Type': opts.contentType } : {}),
        },
        body: file,
      }, 30000)
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
      const response = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${currentSession?.access_token ?? SUPABASE_ANON_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paths),
      }, 15000)
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
    signUp: async ({ email, password }) => {
      const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      }, 15000)
      if (!response.ok) {
        let message = `Sign up failed ${response.status}`
        try {
          const json = await response.json()
          message = json?.error?.message || message
        } catch {
          /* ignore */
        }
        return { data: null, error: new Error(message) }
      }
      const json = await response.json()
      state.user = { id: json.user?.id || json.id || '' }
      state.session = { access_token: json.session?.access_token ?? '' }
      storeSession(state.session)
      storeUser(state.user)
      currentSession = state.session
      notify('SIGNED_UP')
      return { data: { user: state.user, session: state.session }, error: null }
    },
    signInWithPassword: async ({ email, password }) => {
      const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      }, 15000)
      if (!response.ok) {
        let message = `Sign in failed ${response.status}`
        try {
          const json = await response.json()
          message = json?.error?.message || message
        } catch {
          /* ignore */
        }
        return { data: null, error: new Error(message) }
      }
      const json = await response.json()
      state.user = { id: json.user?.id || json.id || '' }
      state.session = { access_token: json.access_token ?? '' }
      storeSession(state.session)
      storeUser(state.user)
      currentSession = state.session
      notify('SIGNED_IN')
      return { data: { user: state.user, session: state.session }, error: null }
    },
    signOut: async () => {
      await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: authHeaders(),
      }, 15000)
      state.user = null
      state.session = null
      storeSession(null)
      storeUser(null)
      currentSession = null
      notify('SIGNED_OUT')
      return { error: null }
    },
    getUser: async () => {
      return { data: { user: state.user }, error: null }
    },
    getSession: async () => {
      return { data: { session: state.session }, error: null }
    },
    onAuthStateChange: (cb) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    },
  },
  from: makeQuery,
  storage: { from: storageFrom },
}

/** Restore persisted session from localStorage. Returns the session or null. */
export function getStoredSession(): { access_token: string } | null {
  return loadStoredSession()
}

/** Get the current session object (may be null). */
export function getCurrentSessionState(): { access_token: string } | null {
  return currentSession
}

/** Set the current session and persist to localStorage. */
export function setCurrentSessionState(session: { access_token: string } | null) {
  currentSession = session
  storeSession(session)
  if (session) {
    state.session = session
  }
  const storedUser = loadStoredUser()
  if (storedUser) {
    currentUser = storedUser
    state.user = storedUser
  }
}

/** Get the stored user from localStorage. Returns the user or null. */
export function getStoredUser(): { id: string } | null {
  return loadStoredUser()
}

/** Get the current user object (may be null). */
export function getCurrentUserState(): { id: string } | null {
  return currentUser
}
