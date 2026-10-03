import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import type { z } from 'zod'
import type { FsDoc, FsDocResult, FsFields, FsQueryResult, FsValue } from '#shared/types/firestore'
import type { querySchema } from './fsSchemas'
import { buildQuery } from './buildQuery'
import { decodeFields, decodeValue, encodeSnapshot } from './fsCodec'
import {
	requireCollectionPath,
	requireDocPath,
	resolveTarget,
	resolveWritableTarget,
	withFirestoreErrors
} from './fsTarget'
import { listDocumentsPage } from './listDocumentsPage'

/**
 * Firestore operations shared by the HTTP API (UI) and the MCP server, so both
 * enforce the same path validation and read-only rules.
 */

export type QueryInput = z.infer<typeof querySchema>

export async function listCollectionIds(
	conn: string,
	db: string,
	docPath?: string
): Promise<string[]> {
	const target = await resolveTarget(conn, db)
	return withFirestoreErrors(async () => {
		const refs = docPath
			? await target.db.doc(requireDocPath(docPath)).listCollections()
			: await target.db.listCollections()
		return refs.map((ref) => ref.id).sort()
	})
}

export async function getDocument(conn: string, db: string, path: string): Promise<FsDocResult> {
	const target = await resolveTarget(conn, db)
	return withFirestoreErrors(async () => {
		const ref = target.db.doc(requireDocPath(path))
		const [snap, collections] = await Promise.all([ref.get(), ref.listCollections()])
		return {
			doc: snap.exists ? encodeSnapshot(snap) : null,
			collections: collections.map((c) => c.id).sort()
		}
	})
}

export async function runQuery(input: QueryInput): Promise<FsQueryResult> {
	const { connection, db } = await resolveTarget(input.conn, input.db)
	const limit = input.limit ?? 50

	return withFirestoreErrors(async () => {
		// Plain browsing lists by name so documents without data (only subcollections) still show.
		if (!input.group && !input.filters?.length && !input.orderBy?.length) {
			const page = await listDocumentsPage(
				connection,
				db,
				input.db,
				requireCollectionPath(input.path),
				limit,
				input.pageToken
			)
			return {
				docs: page.docs,
				hasMore: Boolean(page.nextPageToken),
				nextPageToken: page.nextPageToken
			}
		}

		let query = buildQuery(db, input)
		if (input.startAfter) {
			const cursor = await db.doc(requireDocPath(input.startAfter)).get()
			if (cursor.exists) query = query.startAfter(cursor)
		}
		// Fetch one extra to know whether another page exists.
		const snap = await query.limit(limit + 1).get()
		return { docs: snap.docs.slice(0, limit).map(encodeSnapshot), hasMore: snap.size > limit }
	})
}

export async function countQuery(input: QueryInput): Promise<number> {
	const { db } = await resolveTarget(input.conn, input.db)
	return withFirestoreErrors(async () => (await buildQuery(db, input).count().get()).data().count)
}

export async function setDocument(
	conn: string,
	databaseId: string,
	path: string,
	fields: FsFields,
	mode: 'replace' | 'merge'
): Promise<FsDoc> {
	const { db } = await resolveWritableTarget(conn, databaseId)
	return withFirestoreErrors(async () => {
		const ref = db.doc(requireDocPath(path))
		await ref.set(decodeFields(fields, db), { merge: mode === 'merge' })
		return encodeSnapshot(await ref.get())
	})
}

export async function createDocument(
	conn: string,
	databaseId: string,
	collection: string,
	id: string | undefined,
	fields: FsFields
): Promise<FsDoc> {
	const { db } = await resolveWritableTarget(conn, databaseId)
	return withFirestoreErrors(async () => {
		const col = db.collection(requireCollectionPath(collection))
		const ref = id ? col.doc(id) : col.doc()
		await ref.create(decodeFields(fields, db))
		return encodeSnapshot(await ref.get())
	})
}

export async function deleteDocument(
	conn: string,
	databaseId: string,
	path: string,
	recursive: boolean
): Promise<void> {
	const { db } = await resolveWritableTarget(conn, databaseId)
	await withFirestoreErrors(async () => {
		const ref = db.doc(requireDocPath(path))
		if (recursive) await db.recursiveDelete(ref)
		else await ref.delete()
	})
}

/** Updates one field (segments may contain dots); `value` undefined deletes it. */
export async function updateField(
	conn: string,
	databaseId: string,
	path: string,
	field: string[],
	value: FsValue | undefined
): Promise<FsDoc> {
	const { db } = await resolveWritableTarget(conn, databaseId)
	return withFirestoreErrors(async () => {
		const ref = db.doc(requireDocPath(path))
		await ref.update(new FieldPath(...field), value ? decodeValue(value, db) : FieldValue.delete())
		return encodeSnapshot(await ref.get())
	})
}
