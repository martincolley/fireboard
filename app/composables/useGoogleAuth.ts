/**
 * Browser-only Google sign-in for Firestore access in the hosted app (Google
 * Identity Services token model). The access token lives in memory only: never
 * in storage, never sent to the Fireboard server. It expires after about an hour;
 * the user reconnects with one click.
 */
const SCOPES = [
	'https://www.googleapis.com/auth/datastore',
	'https://www.googleapis.com/auth/cloudplatformprojects.readonly'
].join(' ')
const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface TokenResponse {
	access_token?: string
	expires_in?: number
	error?: string
	error_description?: string
}

interface TokenClient {
	requestAccessToken(options?: { prompt?: string }): void
}

interface GoogleAccounts {
	oauth2: {
		initTokenClient(config: {
			client_id: string
			scope: string
			callback: (response: TokenResponse) => void
			error_callback?: (error: { type: string; message?: string }) => void
		}): TokenClient
		revoke(token: string, done?: () => void): void
	}
}

declare global {
	interface Window {
		google?: { accounts: GoogleAccounts }
	}
}

let token: { value: string; expiresAt: number } | null = null
let gisLoading: Promise<GoogleAccounts> | null = null

function loadGis(): Promise<GoogleAccounts> {
	if (window.google?.accounts) return Promise.resolve(window.google.accounts)
	gisLoading ??= new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = GIS_SRC
		script.async = true
		script.onload = () =>
			window.google?.accounts
				? resolve(window.google.accounts)
				: reject(new Error('Google sign-in failed to load'))
		script.onerror = () => {
			gisLoading = null
			reject(new Error('Google sign-in failed to load'))
		}
		document.head.appendChild(script)
	})
	return gisLoading
}

const HINT_KEY = 'fireboard:google-connected-before'

/** A non-secret hint (no token) so the UI can offer "reconnect" after a reload. */
function rememberConnected() {
	try {
		localStorage.setItem(HINT_KEY, '1')
	} catch {
		// Non-essential.
	}
}

function connectedBefore(): boolean {
	try {
		return localStorage.getItem(HINT_KEY) === '1'
	} catch {
		return false
	}
}

export class GoogleReconnectRequired extends Error {
	constructor() {
		super('Connect your Google account to read this project')
	}
}

export function useGoogleAuth() {
	const clientId = useRuntimeConfig().public.googleClientId as string
	const state = useState('google-auth', () => ({ connected: false, expiresAt: 0 }))

	/** Opens Google's consent popup. Must be called from a click. */
	async function connect(): Promise<void> {
		if (!clientId)
			throw new Error('Google sign-in is not configured (NUXT_PUBLIC_GOOGLE_CLIENT_ID)')
		const accounts = await loadGis()
		await new Promise<void>((resolve, reject) => {
			const client = accounts.oauth2.initTokenClient({
				client_id: clientId,
				scope: SCOPES,
				callback: (response) => {
					if (!response.access_token) {
						reject(
							new Error(response.error_description || response.error || 'Google sign-in failed')
						)
						return
					}
					const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
					token = { value: response.access_token, expiresAt }
					state.value = { connected: true, expiresAt }
					rememberConnected()
					resolve()
				},
				error_callback: (error) => reject(new Error(error.message || error.type))
			})
			client.requestAccessToken({ prompt: state.value.connected ? '' : 'consent' })
		})
	}

	/** A valid access token, or GoogleReconnectRequired when the user must click to reconnect. */
	async function getToken(): Promise<string> {
		if (token && token.expiresAt - 60_000 > Date.now()) return token.value
		token = null
		state.value = { connected: false, expiresAt: 0 }
		throw new GoogleReconnectRequired()
	}

	async function disconnect(): Promise<void> {
		const current = token?.value
		token = null
		state.value = { connected: false, expiresAt: 0 }
		if (current) (await loadGis()).oauth2.revoke(current)
	}

	/** Google Cloud projects the signed-in Google account can see (for the project picker). */
	async function listProjects(): Promise<{ projectId: string; name: string }[]> {
		const res = await $fetch<{
			projects?: { projectId: string; name?: string; lifecycleState?: string }[]
		}>('https://cloudresourcemanager.googleapis.com/v1/projects', {
			headers: { Authorization: `Bearer ${await getToken()}` },
			query: { pageSize: 500 }
		})
		return (res.projects ?? [])
			.filter((p) => p.lifecycleState !== 'DELETE_REQUESTED')
			.map((p) => ({ projectId: p.projectId, name: p.name ?? p.projectId }))
			.sort((a, b) => a.name.localeCompare(b.name))
	}

	return {
		state,
		connect,
		getToken,
		disconnect,
		listProjects,
		connectedBefore,
		configured: Boolean(clientId)
	}
}
