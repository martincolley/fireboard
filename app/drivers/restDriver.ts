import { FirestoreRestClient } from '#shared/firestore-rest/client'
import type { Connection } from '#shared/types/connection'
import type { DataDriver } from './types'

/**
 * Hosted build: Firestore straight from the browser. Google connections use
 * the signed-in user's short-lived token; emulator connections use "owner".
 */
export function createRestDriver(
	connection: Connection,
	getGoogleToken: () => Promise<string>
): DataDriver {
	const emulatorHost =
		connection.credential.type === 'emulator' ? connection.credential.host : undefined
	const client = new FirestoreRestClient({
		projectId: connection.projectId,
		emulatorHost,
		getToken: emulatorHost ? async () => 'owner' : getGoogleToken
	})
	/** Read-only is a convenience guard here; Google IAM is what actually protects the data. */
	const writable = <T>(run: () => Promise<T>): Promise<T> =>
		connection.readOnly
			? Promise.reject(new Error(`Connection "${connection.name}" is read-only`))
			: run()

	return {
		listDatabases: async () =>
			connection.databases?.length
				? { databases: connection.databases.map((id) => ({ id })) }
				: client.listDatabases(),
		listCollections: (db, docPath) => client.listCollectionIds(db, docPath),
		getDocument: (db, path) => client.getDocument(db, path),
		runQuery: (query, cursor) =>
			client.runQuery({ ...query, conn: connection.id }, query.pageToken ? undefined : cursor),
		count: (query) => client.count({ ...query, conn: connection.id }),
		setDocument: (db, path, fields) => writable(() => client.setDocument(db, path, fields)),
		createDocument: (db, collection, id, fields) =>
			writable(() => client.createDocument(db, collection, id || undefined, fields)),
		updateField: (db, path, field, value) =>
			writable(() => client.updateField(db, path, field, value)),
		deleteDocument: (db, path, recursive) =>
			writable(() => client.deleteDocument(db, path, recursive))
	}
}
