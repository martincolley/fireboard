import type { FsFields } from '#shared/types/firestore'
import type { SnapshotMeta } from '#shared/types/snapshot'

/** A snapshot kept in the browser (hosted app): anonymized documents only. */
export interface StoredSnapshot {
	meta: SnapshotMeta
	docs: { path: string; fields: FsFields }[]
}

const DB_NAME = 'fireboard'
const STORE = 'snapshots'

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1)
		request.onupgradeneeded = () =>
			request.result.createObjectStore(STORE, { keyPath: 'meta.name' })
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

async function run<T>(
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const db = await open()
	try {
		return await new Promise<T>((resolve, reject) => {
			const request = action(db.transaction(STORE, mode).objectStore(STORE))
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error)
		})
	} finally {
		db.close()
	}
}

export const snapshotStore = {
	list: async (): Promise<SnapshotMeta[]> =>
		(await run<StoredSnapshot[]>('readonly', (s) => s.getAll()))
			.map((s) => s.meta)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
	get: (name: string) => run<StoredSnapshot | undefined>('readonly', (s) => s.get(name)),
	put: (snapshot: StoredSnapshot) => run('readwrite', (s) => s.put(snapshot)),
	remove: (name: string) => run('readwrite', (s) => s.delete(name))
}
