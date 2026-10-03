import type { Firestore } from 'firebase-admin/firestore'
import type { Connection } from '#shared/types/connection'
import { isCollectionPath, isDocumentPath, normalizePath } from '#shared/utils/paths'
import { getConnection } from './connectionStore'
import { errorMessage, getDb } from './firestoreClients'

export interface FsTarget {
	connection: Connection
	db: Firestore
}

/** Resolves the connection + database a request targets. */
export async function resolveTarget(conn: string, databaseId: string): Promise<FsTarget> {
	const connection = await getConnection(conn)
	return { connection, db: await getDb(connection, databaseId) }
}

/** Same as resolveTarget, but refuses read-only connections. Use for every write. */
export async function resolveWritableTarget(conn: string, databaseId: string): Promise<FsTarget> {
	const target = await resolveTarget(conn, databaseId)
	if (target.connection.readOnly) {
		throw createError({
			statusCode: 403,
			message: `Connection "${target.connection.name}" is read-only`
		})
	}
	return target
}

export function requireDocPath(path: string): string {
	const normalized = normalizePath(path)
	if (!isDocumentPath(normalized)) {
		throw createError({ statusCode: 400, message: `Not a document path: "${path}"` })
	}
	return normalized
}

export function requireCollectionPath(path: string): string {
	const normalized = normalizePath(path)
	if (!isCollectionPath(normalized)) {
		throw createError({ statusCode: 400, message: `Not a collection path: "${path}"` })
	}
	return normalized
}

/** Wraps Firestore errors (permission, missing index...) into readable HTTP errors. */
export async function withFirestoreErrors<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run()
	} catch (error) {
		if (error && typeof error === 'object' && 'statusCode' in error) throw error
		throw createError({ statusCode: 502, message: errorMessage(error) })
	}
}
