import type {
	DatabaseList,
	FsDoc,
	FsDocResult,
	FsFields,
	FsQuery,
	FsQueryResult,
	FsValue
} from '../types/firestore'
import {
	documentName,
	documentsRoot,
	fieldPathString,
	fromRestDocument,
	toRestFields,
	toRestValue,
	type RestDocument
} from './codec'
import { buildStructuredQuery } from './query'

const PRODUCTION_BASE = 'https://firestore.googleapis.com/v1'
const DEFAULT_DATABASE = '(default)'

export interface RestTarget {
	projectId: string
	/** Bearer token: a Google OAuth access token, or "owner" for the emulator. */
	getToken: () => Promise<string>
	/** Emulator host ("127.0.0.1:8080"); omit for production Firestore. */
	emulatorHost?: string
	fetch?: typeof fetch
}

export class FirestoreRestError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message)
	}
}

/**
 * Firestore over its public REST API, usable from a browser (with the
 * signed-in user's Google token) or from Node. Credentials never leave the
 * caller: nothing here talks to a Fireboard server.
 */
export class FirestoreRestClient {
	private readonly base: string
	private readonly fetcher: typeof fetch

	constructor(private readonly target: RestTarget) {
		this.base = target.emulatorHost ? `http://${target.emulatorHost}/v1` : PRODUCTION_BASE
		this.fetcher = target.fetch ?? globalThis.fetch.bind(globalThis)
	}

	private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
		const res = await this.fetcher(`${this.base}/${url}`, {
			method,
			headers: {
				Authorization: `Bearer ${await this.target.getToken()}`,
				...(body === undefined ? {} : { 'Content-Type': 'application/json' })
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		})
		const text = await res.text()
		if (!res.ok) {
			let message = `${res.status} ${res.statusText}`
			try {
				message = JSON.parse(text).error?.message ?? message
			} catch {
				// Not JSON.
			}
			throw new FirestoreRestError(message, res.status)
		}
		return (text ? JSON.parse(text) : {}) as T
	}

	private root(db: string): string {
		return documentsRoot(this.target.projectId, db)
	}

	async listDatabases(): Promise<DatabaseList> {
		if (this.target.emulatorHost)
			return { databases: [{ id: DEFAULT_DATABASE, locationId: 'emulator' }] }
		const res = await this.request<{
			databases?: { name: string; locationId?: string; type?: string }[]
		}>('GET', `projects/${encodeURIComponent(this.target.projectId)}/databases`)
		const databases = (res.databases ?? []).map((d) => ({
			id: d.name.split('/').at(-1)!,
			locationId: d.locationId,
			type: d.type
		}))
		databases.sort((a, b) =>
			a.id === DEFAULT_DATABASE ? -1 : b.id === DEFAULT_DATABASE ? 1 : a.id.localeCompare(b.id)
		)
		return { databases }
	}

	/** Root collections, or subcollections of `docPath`. */
	async listCollectionIds(db: string, docPath?: string): Promise<string[]> {
		const parent = docPath ? `${this.root(db)}/${encodePath(docPath)}` : this.root(db)
		const ids: string[] = []
		let pageToken: string | undefined
		do {
			const res = await this.request<{ collectionIds?: string[]; nextPageToken?: string }>(
				'POST',
				`${parent}:listCollectionIds`,
				{ pageSize: 300, pageToken }
			)
			ids.push(...(res.collectionIds ?? []))
			pageToken = res.nextPageToken || undefined
		} while (pageToken)
		return ids.sort()
	}

	async getDocument(db: string, path: string): Promise<FsDocResult> {
		const [doc, collections] = await Promise.all([
			this.request<RestDocument>('GET', `${this.root(db)}/${encodePath(path)}`).then(
				fromRestDocument,
				(error: unknown) => {
					if (error instanceof FirestoreRestError && error.status === 404) return null
					throw error
				}
			),
			this.listCollectionIds(db, path)
		])
		return { doc, collections }
	}

	/** One page of a collection by id, including missing (data-less) parents. */
	async listDocuments(
		db: string,
		collectionPath: string,
		pageSize: number,
		pageToken?: string
	): Promise<{ docs: FsDoc[]; nextPageToken?: string }> {
		let params = `pageSize=${pageSize}&showMissing=true`
		if (pageToken) params += `&pageToken=${encodeURIComponent(pageToken)}`
		const res = await this.request<{ documents?: RestDocument[]; nextPageToken?: string }>(
			'GET',
			`${this.root(db)}/${encodePath(collectionPath)}?${params}`
		)
		return {
			docs: (res.documents ?? []).map(fromRestDocument),
			nextPageToken: res.nextPageToken || undefined
		}
	}

	/**
	 * Same semantics as the server API: plain browsing lists by id (with missing
	 * docs, paged by token); filters/orders run a structured query (paged by the
	 * last document).
	 */
	async runQuery(q: FsQuery, cursorDoc?: FsDoc): Promise<FsQueryResult> {
		const limit = q.limit ?? 50
		if (!q.group && !q.filters?.length && !q.orderBy?.length) {
			const page = await this.listDocuments(q.db, q.path, limit, q.pageToken)
			return {
				docs: page.docs,
				hasMore: Boolean(page.nextPageToken),
				nextPageToken: page.nextPageToken
			}
		}
		const built = buildStructuredQuery({ ...q, limit: limit + 1 }, this.target.projectId, cursorDoc)
		const rows = await this.request<{ document?: RestDocument }[]>(
			'POST',
			`${built.parent}:runQuery`,
			{
				structuredQuery: built.structuredQuery
			}
		)
		const docs = rows.filter((r) => r.document).map((r) => fromRestDocument(r.document!))
		return { docs: docs.slice(0, limit), hasMore: docs.length > limit }
	}

	async count(q: FsQuery): Promise<number> {
		const built = buildStructuredQuery({ ...q, limit: undefined }, this.target.projectId)
		const rows = await this.request<
			{ result?: { aggregateFields?: Record<string, { integerValue?: string }> } }[]
		>('POST', `${built.parent}:runAggregationQuery`, {
			structuredAggregationQuery: {
				structuredQuery: { ...built.structuredQuery, orderBy: undefined },
				aggregations: [{ alias: 'count', count: {} }]
			}
		})
		return Number(rows[0]?.result?.aggregateFields?.count?.integerValue ?? 0)
	}

	private async getRequired(db: string, path: string): Promise<FsDoc> {
		return fromRestDocument(
			await this.request<RestDocument>('GET', `${this.root(db)}/${encodePath(path)}`)
		)
	}

	/** Replaces the whole document (creates it if missing). */
	async setDocument(db: string, path: string, fields: FsFields): Promise<FsDoc> {
		const doc = await this.request<RestDocument>('PATCH', `${this.root(db)}/${encodePath(path)}`, {
			fields: toRestFields(fields, this.target.projectId, db)
		})
		return fromRestDocument(doc)
	}

	/** Creates a document; fails if it exists. Empty id = auto id. */
	async createDocument(
		db: string,
		collectionPath: string,
		id: string | undefined,
		fields: FsFields
	): Promise<FsDoc> {
		const segments = collectionPath.split('/').filter(Boolean)
		const collectionId = segments.pop()!
		const parent = segments.length
			? `${this.root(db)}/${encodePath(segments.join('/'))}`
			: this.root(db)
		const query = id ? `?documentId=${encodeURIComponent(id)}` : ''
		const doc = await this.request<RestDocument>(
			'POST',
			`${parent}/${encodeURIComponent(collectionId)}${query}`,
			{
				fields: toRestFields(fields, this.target.projectId, db)
			}
		)
		return fromRestDocument(doc)
	}

	/** Updates (or deletes, when value is undefined) one field of an existing document. */
	async updateField(
		db: string,
		path: string,
		field: string[],
		value: FsValue | undefined
	): Promise<FsDoc> {
		// Built by hand: URLSearchParams encodes spaces as "+", which Firestore reads literally.
		const params = `updateMask.fieldPaths=${encodeURIComponent(fieldPathString(field))}&currentDocument.exists=true`
		const fields: FsFields = {}
		if (value) {
			// Nest the value under its field path; the mask limits the write to that path.
			let cursor = fields
			field.forEach((segment, i) => {
				if (i === field.length - 1) cursor[segment] = value
				else {
					const next: FsFields = {}
					cursor[segment] = { t: 'map', v: next }
					cursor = next
				}
			})
		}
		await this.request('PATCH', `${this.root(db)}/${encodePath(path)}?${params}`, {
			fields: toRestFields(fields, this.target.projectId, db)
		})
		return this.getRequired(db, path)
	}

	async deleteDocument(db: string, path: string, recursive: boolean): Promise<void> {
		if (recursive) {
			for (const sub of await this.listCollectionIds(db, path)) {
				await this.deleteCollection(db, `${path}/${sub}`)
			}
		}
		await this.request('DELETE', `${this.root(db)}/${encodePath(path)}`)
	}

	private async deleteCollection(db: string, collectionPath: string): Promise<void> {
		let pageToken: string | undefined
		do {
			const page = await this.listDocuments(db, collectionPath, 300, pageToken)
			pageToken = page.nextPageToken
			for (const doc of page.docs) await this.deleteDocument(db, doc.path, true)
		} while (pageToken)
	}

	/** Writes many documents (replace semantics) in commits of up to 500. */
	async writeDocuments(db: string, docs: { path: string; fields: FsFields }[]): Promise<number> {
		let written = 0
		for (let i = 0; i < docs.length; i += 500) {
			const chunk = docs.slice(i, i + 500)
			await this.request('POST', `${this.root(db).replace(/\/documents$/, '')}/documents:commit`, {
				writes: chunk.map((d) => ({
					update: {
						name: documentName(this.target.projectId, db, d.path),
						fields: toRestFields(d.fields, this.target.projectId, db)
					}
				}))
			})
			written += chunk.length
		}
		return written
	}

	/** Emulator only: deletes every document in the database. */
	async wipeEmulator(db: string): Promise<void> {
		if (!this.target.emulatorHost)
			throw new Error('Wipe is only available for emulator connections')
		const res = await this.fetcher(
			`http://${this.target.emulatorHost}/emulator/v1/projects/${encodeURIComponent(this.target.projectId)}/databases/${encodeURIComponent(db)}/documents`,
			{ method: 'DELETE' }
		)
		if (!res.ok) throw new FirestoreRestError(`Emulator wipe failed: ${res.status}`, res.status)
	}
}

/** Encodes each path segment for use in a URL. */
function encodePath(path: string): string {
	return path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

export { toRestValue }
