import type { Firestore } from 'firebase-admin/firestore'
import type { Connection } from '#shared/types/connection'
import type { FsDoc } from '#shared/types/firestore'
import { restBase, restHeaders } from './firestoreClients'
import { encodeSnapshot } from './fsCodec'

interface ListDocumentsResponse {
	documents?: { name: string; createTime?: string }[]
	nextPageToken?: string
}

/** Field mask that matches nothing, so the listing returns names only. */
const EMPTY_MASK = 'fireboard_no_such_field'

/**
 * Lists one page of a collection *including missing documents*: ids that have
 * no data but do have subcollections (common for regional databases where the
 * parent doc lives elsewhere). Queries never return those, Firefoo and the
 * console do. Uses the REST listDocuments API with showMissing, then loads the
 * existing ones through the Admin SDK so values decode the normal way.
 */
export async function listDocumentsPage(
	connection: Connection,
	db: Firestore,
	databaseId: string,
	collectionPath: string,
	pageSize: number,
	pageToken?: string
): Promise<{ docs: FsDoc[]; nextPageToken?: string }> {
	const encodedPath = collectionPath.split('/').map(encodeURIComponent).join('/')
	const url = `${restBase(connection)}/projects/${encodeURIComponent(connection.projectId)}/databases/${encodeURIComponent(databaseId)}/documents/${encodedPath}`

	const res = await $fetch<ListDocumentsResponse>(url, {
		headers: await restHeaders(connection),
		query: {
			pageSize,
			pageToken,
			showMissing: true,
			'mask.fieldPaths': EMPTY_MASK
		}
	})

	const listed = (res.documents ?? []).map((d) => ({
		path: d.name.split('/documents/')[1]!,
		exists: Boolean(d.createTime)
	}))
	const existing = listed.filter((d) => d.exists).map((d) => db.doc(d.path))
	const snaps = existing.length ? await db.getAll(...existing) : []
	const byPath = new Map(snaps.map((snap) => [snap.ref.path, encodeSnapshot(snap)]))

	const docs = listed.map<FsDoc>(
		(d) =>
			byPath.get(d.path) ?? {
				id: d.path.split('/').at(-1)!,
				path: d.path,
				fields: {},
				missing: true
			}
	)
	return { docs, nextPageToken: res.nextPageToken || undefined }
}
