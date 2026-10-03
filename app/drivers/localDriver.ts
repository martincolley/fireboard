import type { DatabaseList, FsDoc, FsDocResult, FsQueryResult } from '#shared/types/firestore'
import type { DataDriver } from './types'

/** Local build: every call goes to the Fireboard server, which holds the connection's credentials. */
export function createLocalDriver(conn: string): DataDriver {
	return {
		listDatabases: () =>
			api<DatabaseList>(`/api/connections/${encodeURIComponent(conn)}/databases`),
		listCollections: async (db, docPath) =>
			(
				await api<{ collections: string[] }>('/api/fs/collections', {
					query: { conn, db, path: docPath }
				})
			).collections,
		getDocument: (db, path) => api<FsDocResult>('/api/fs/doc', { query: { conn, db, path } }),
		runQuery: (query, cursor) =>
			api<FsQueryResult>('/api/fs/query', {
				method: 'POST',
				body: { ...query, conn, startAfter: query.pageToken ? undefined : cursor?.path }
			}),
		count: async (query) =>
			(await api<{ count: number }>('/api/fs/count', { method: 'POST', body: { ...query, conn } }))
				.count,
		setDocument: (db, path, fields) =>
			api<FsDoc>('/api/fs/doc', {
				method: 'PUT',
				body: { conn, db, path, fields, mode: 'replace' }
			}),
		createDocument: (db, collection, id, fields) =>
			api<FsDoc>('/api/fs/doc', {
				method: 'POST',
				body: { conn, db, collection, id: id || undefined, fields }
			}),
		updateField: (db, path, field, value) =>
			api<FsDoc>('/api/fs/field', { method: 'PATCH', body: { conn, db, path, field, value } }),
		deleteDocument: async (db, path, recursive) => {
			await api('/api/fs/doc', { method: 'DELETE', body: { conn, db, path, recursive } })
		}
	}
}
