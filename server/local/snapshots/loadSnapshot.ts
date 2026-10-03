import { createError } from 'h3'
import type { Connection } from '#shared/types/connection'
import type { SnapshotLoadResult } from '#shared/types/snapshot'
import { assertSnapshotData, readMeta, readSnapshotDocs } from './store'
import { errorMessage } from '../firestoreClients'
import { decodeFields } from '../fsCodec'
import { resolveWritableTarget } from '../fsTarget'

export interface LoadInput {
	name: string
	conn: string
	db: string
	/** Delete every document in the target emulator database first. */
	wipe: boolean
}

const MAX_REPORTED_ERRORS = 5

/** Snapshots may only ever be written into a local emulator, never a real project. */
export function assertEmulatorTarget(
	connection: Connection
): asserts connection is Connection & { credential: { type: 'emulator'; host: string } } {
	if (connection.credential.type !== 'emulator') {
		throw createError({
			statusCode: 400,
			message: 'Snapshots can only be loaded into emulator connections'
		})
	}
}

/** Writes a snapshot into a Firestore emulator database. */
export async function loadSnapshot(input: LoadInput): Promise<SnapshotLoadResult> {
	await readMeta(input.name)
	await assertSnapshotData(input.name)
	const { connection, db } = await resolveWritableTarget(input.conn, input.db)
	assertEmulatorTarget(connection)

	if (input.wipe) {
		await $fetch(
			`http://${connection.credential.host}/emulator/v1/projects/${encodeURIComponent(connection.projectId)}/databases/${encodeURIComponent(input.db)}/documents`,
			{ method: 'DELETE' }
		)
	}

	let written = 0
	let failed = 0
	const errors: string[] = []
	const recordError = (error: unknown) => {
		failed++
		if (errors.length < MAX_REPORTED_ERRORS) errors.push(errorMessage(error))
	}
	const writer = db.bulkWriter()
	writer.onWriteError(() => false)
	try {
		for await (const doc of readSnapshotDocs(input.name)) {
			try {
				writer
					.set(db.doc(doc.path), decodeFields(doc.fields, db))
					.then(() => written++)
					.catch(recordError)
			} catch (error) {
				recordError(error)
			}
		}
	} finally {
		await writer.close()
	}
	return { written, failed, errors, wiped: input.wipe }
}
