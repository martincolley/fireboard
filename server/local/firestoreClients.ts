import { readFile } from 'node:fs/promises'
import {
	applicationDefault,
	cert,
	deleteApp,
	getApps,
	initializeApp,
	type App,
	type Credential
} from 'firebase-admin/app'
import { Firestore as GoogleFirestore } from '@google-cloud/firestore'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import type { Connection } from '#shared/types/connection'
import type { DatabaseInfo, DatabaseList } from '#shared/types/firestore'

export const DEFAULT_DATABASE_ID = '(default)'

/** Fingerprint of the settings an App was built from, so edited connections get a fresh App. */
const appSignatures = new Map<string, string>()

/** The emulator accepts the literal token "owner" as an admin. */
const emulatorCredential: Credential = {
	getAccessToken: async () => ({ access_token: 'owner', expires_in: 3600 })
}

async function buildCredential(connection: Connection): Promise<Credential> {
	if (connection.credential.type === 'emulator') return emulatorCredential
	if (connection.credential.type === 'adc') return applicationDefault()
	if (connection.credential.type === 'google') {
		throw createError({
			statusCode: 400,
			message: 'Google sign-in connections only work in the hosted app'
		})
	}
	const json = JSON.parse(await readFile(connection.credential.path, 'utf8'))
	return cert(json)
}

/** One Firebase Admin App per connection, named by connection id. */
export async function getConnectionApp(connection: Connection): Promise<App> {
	const signature = JSON.stringify([connection.projectId, connection.credential])
	const existing = getApps().find((app) => app.name === connection.id)
	if (existing && appSignatures.get(connection.id) === signature) return existing
	if (existing) await deleteApp(existing)

	const app = initializeApp(
		{ credential: await buildCredential(connection), projectId: connection.projectId },
		connection.id
	)
	appSignatures.set(connection.id, signature)
	return app
}

/**
 * Emulator clients are built directly with @google-cloud/firestore (the same
 * class firebase-admin wraps): firebase-admin refuses to create a Firestore
 * without real Google credentials, which the emulator doesn't need.
 */
const emulatorDbs = new Map<string, Firestore>()

function getEmulatorDb(connection: Connection, host: string, databaseId: string): Firestore {
	const key = JSON.stringify([connection.id, connection.projectId, host, databaseId])
	let db = emulatorDbs.get(key)
	if (!db) {
		db = new GoogleFirestore({ projectId: connection.projectId, databaseId, host, ssl: false })
		emulatorDbs.set(key, db)
	}
	return db
}

/** Closes cached clients for a connection after it is edited or removed. */
export async function evictConnection(id: string): Promise<void> {
	for (const [key, db] of emulatorDbs) {
		if (JSON.parse(key)[0] === id) {
			emulatorDbs.delete(key)
			await db.terminate().catch(() => {})
		}
	}
	const app = getApps().find((a) => a.name === id)
	if (app) {
		appSignatures.delete(id)
		await deleteApp(app)
	}
}

export async function getDb(connection: Connection, databaseId: string): Promise<Firestore> {
	if (connection.credential.type === 'emulator') {
		return getEmulatorDb(connection, connection.credential.host, databaseId)
	}
	const app = await getConnectionApp(connection)
	return databaseId === DEFAULT_DATABASE_ID ? getFirestore(app) : getFirestore(app, databaseId)
}

export function isEmulator(connection: Connection): boolean {
	return connection.credential.type === 'emulator'
}

const FIRESTORE_REST = 'https://firestore.googleapis.com/v1'

/** REST base URL: production Firestore, or the emulator's HTTP endpoint. */
export function restBase(connection: Connection): string {
	return connection.credential.type === 'emulator'
		? `http://${connection.credential.host}/v1`
		: FIRESTORE_REST
}

/** Auth headers for calling Firestore REST endpoints the Admin SDK doesn't expose. */
export async function restHeaders(connection: Connection): Promise<Record<string, string>> {
	const app = await getConnectionApp(connection)
	const { access_token } = await app.options.credential!.getAccessToken()
	const headers: Record<string, string> = { Authorization: `Bearer ${access_token}` }
	// User (ADC) credentials need a quota project for these APIs.
	if (connection.credential.type === 'adc') headers['x-goog-user-project'] = connection.projectId
	return headers
}

interface ListDatabasesResponse {
	databases?: { name: string; locationId?: string; type?: string }[]
}

/**
 * Lists every Firestore database in the project via the Firestore Admin REST
 * API. Falls back to the configured list (or just "(default)") if the
 * credential lacks `datastore.databases.list`.
 */
export async function listDatabases(connection: Connection): Promise<DatabaseList> {
	if (connection.databases?.length) {
		return { databases: connection.databases.map((id) => ({ id })) }
	}
	// The emulator creates databases on first write and has no listing API.
	if (connection.credential.type === 'emulator') {
		return { databases: [{ id: DEFAULT_DATABASE_ID, locationId: 'emulator' }] }
	}
	try {
		const res = await $fetch<ListDatabasesResponse>(
			`${FIRESTORE_REST}/projects/${encodeURIComponent(connection.projectId)}/databases`,
			{ headers: await restHeaders(connection) }
		)
		const databases: DatabaseInfo[] = (res.databases ?? []).map((db) => ({
			id: db.name.split('/').at(-1)!,
			locationId: db.locationId,
			type: db.type
		}))
		databases.sort((a, b) =>
			a.id === DEFAULT_DATABASE_ID
				? -1
				: b.id === DEFAULT_DATABASE_ID
					? 1
					: a.id.localeCompare(b.id)
		)
		return { databases }
	} catch (error) {
		return {
			databases: [{ id: DEFAULT_DATABASE_ID }],
			warning: `Could not list databases (${errorMessage(error)}). Add a "databases" list to the connection to pin them.`
		}
	}
}

export function errorMessage(error: unknown): string {
	if (error && typeof error === 'object') {
		const data = (error as { data?: { error?: { message?: string } } }).data
		if (data?.error?.message) return data.error.message
		if ('message' in error && typeof error.message === 'string') return error.message
	}
	return String(error)
}
