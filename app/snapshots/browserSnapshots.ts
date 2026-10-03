import { z } from 'zod'
import { Anonymizer } from '#shared/anonymize/anonymizer'
import { fsFieldsSchema } from '#shared/schemas/fsValue'
import { isDocumentPath, normalizePath } from '#shared/utils/paths'
import { effectiveConfig, overridesSchema, type AnonymizeOverrides } from '#shared/anonymize/config'
import { FirestoreRestClient } from '#shared/firestore-rest/client'
import { anonymizeDocuments, collectDocuments } from '#shared/snapshots/collect'
import type { Connection } from '#shared/types/connection'
import type { SnapshotLoadResult, SnapshotMeta } from '#shared/types/snapshot'
import { snapshotStore, type StoredSnapshot } from './idb'

const SALT_KEY = 'fireboard:anonymize-salt'
const OVERRIDES_KEY = 'fireboard:anonymize-overrides'

/** Per-browser secret so fakes are stable across snapshots taken in this browser. */
function salt(): string {
	let value = localStorage.getItem(SALT_KEY)
	if (!value) {
		const bytes = crypto.getRandomValues(new Uint8Array(32))
		value = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
		localStorage.setItem(SALT_KEY, value)
	}
	return value
}

export function readOverrides(): AnonymizeOverrides {
	const raw = localStorage.getItem(OVERRIDES_KEY)
	return overridesSchema.parse(raw ? JSON.parse(raw) : {})
}

export function writeOverrides(json: string): void {
	const parsed = overridesSchema.parse(JSON.parse(json))
	localStorage.setItem(OVERRIDES_KEY, JSON.stringify(parsed))
}

export interface BrowserExportInput {
	name: string
	connection: Connection
	db: string
	paths: string[]
	recursive: boolean
	maxDocs: number
	getGoogleToken: () => Promise<string>
}

function clientFor(connection: Connection, getGoogleToken: () => Promise<string>) {
	const emulatorHost =
		connection.credential.type === 'emulator' ? connection.credential.host : undefined
	return new FirestoreRestClient({
		projectId: connection.projectId,
		emulatorHost,
		getToken: emulatorHost ? async () => 'owner' : getGoogleToken
	})
}

/**
 * Hosted app: reads real data straight from Firestore in the browser,
 * anonymizes it in memory and keeps only the anonymized copy (IndexedDB).
 */
export async function exportInBrowser(input: BrowserExportInput): Promise<SnapshotMeta> {
	const client = clientFor(input.connection, input.getGoogleToken)
	const anonymizer = new Anonymizer(effectiveConfig(readOverrides()), salt())
	const { docs, truncated } = await collectDocuments(
		{
			listDocuments: (path, pageSize, pageToken) =>
				client.listDocuments(input.db, path, pageSize, pageToken),
			listCollections: (docPath) => client.listCollectionIds(input.db, docPath),
			getDocument: async (path) => (await client.getDocument(input.db, path)).doc
		},
		input
	)
	const anonymized = anonymizeDocuments(docs, anonymizer)
	const meta: SnapshotMeta = {
		name: input.name,
		createdAt: new Date().toISOString(),
		source: {
			conn: input.connection.id,
			projectId: input.connection.projectId,
			db: input.db,
			paths: input.paths.map((p) => anonymizer.path(p))
		},
		recursive: input.recursive,
		docCount: anonymized.length,
		truncated,
		anonymized: true
	}
	await snapshotStore.put({ meta, docs: anonymized })
	return meta
}

/** Writes a stored snapshot into an emulator. Never into a real project. */
export async function loadInBrowser(
	name: string,
	target: Connection,
	db: string,
	wipe: boolean
): Promise<SnapshotLoadResult> {
	if (target.credential.type !== 'emulator') {
		throw new Error('Snapshots can only be loaded into emulator connections')
	}
	const snapshot = await snapshotStore.get(name)
	if (!snapshot) throw new Error(`Snapshot "${name}" not found`)
	const client = clientFor(target, async () => 'owner')
	if (wipe) await client.wipeEmulator(db)
	const written = await client.writeDocuments(db, snapshot.docs)
	return { written, failed: 0, errors: [], wiped: wipe }
}

/** NDJSON file: first line is the metadata, then one anonymized document per line. */
export function toNdjson(snapshot: StoredSnapshot): Blob {
	const lines = [
		JSON.stringify({ meta: snapshot.meta }),
		...snapshot.docs.map((d) => JSON.stringify(d))
	]
	return new Blob([`${lines.join('\n')}\n`], { type: 'application/x-ndjson' })
}

const importedMetaSchema = z.object({
	name: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i),
	createdAt: z.string(),
	source: z.object({
		conn: z.string(),
		projectId: z.string(),
		db: z.string(),
		paths: z.array(z.string())
	}),
	recursive: z.boolean(),
	docCount: z.number(),
	truncated: z.boolean(),
	anonymized: z.literal(true)
})
const importedDocSchema = z.object({
	path: z
		.string()
		.refine(
			(path) => isDocumentPath(path) && path === normalizePath(path),
			'Invalid document path'
		),
	fields: fsFieldsSchema
})

/**
 * Imports a snapshot file (e.g. from a teammate). Every line is validated
 * before anything is stored; an existing snapshot with the same name is kept
 * and the import gets a new name.
 */
export async function importNdjson(text: string): Promise<SnapshotMeta> {
	const [head, ...rest] = text.split('\n').filter((line) => line.trim())
	const parsedHead = z.object({ meta: importedMetaSchema }).safeParse(JSON.parse(head ?? '{}'))
	if (!parsedHead.success) throw new Error('Not a Fireboard snapshot file')
	const docs = rest.map((line, i) => {
		const doc = importedDocSchema.safeParse(JSON.parse(line))
		if (!doc.success) throw new Error(`Invalid document on line ${i + 2} of the snapshot file`)
		return doc.data
	})
	let name = parsedHead.data.meta.name
	const existing = new Set((await snapshotStore.list()).map((m) => m.name))
	for (let n = 2; existing.has(name); n++) name = `${parsedHead.data.meta.name}-${n}`
	const meta: SnapshotMeta = { ...parsedHead.data.meta, name, docCount: docs.length }
	await snapshotStore.put({ meta, docs })
	return meta
}
