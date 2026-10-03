import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { once } from 'node:events'
import {
	anonymizeDocuments,
	collectDocuments,
	type SnapshotSource
} from '#shared/snapshots/collect'
import { isDocumentPath, normalizePath } from '#shared/utils/paths'
import type { SnapshotMeta } from '#shared/types/snapshot'
import { Anonymizer } from '#shared/anonymize/anonymizer'
import { loadAnonymizeConfig, loadSalt } from '../anonymize/config'
import { snapshotDir, snapshotsDir, writeMeta } from './store'
import { encodeSnapshot } from '../fsCodec'
import { requireCollectionPath, resolveTarget, withFirestoreErrors } from '../fsTarget'
import { listDocumentsPage } from '../listDocumentsPage'

export interface ExportInput {
	name: string
	conn: string
	db: string
	/** Collection or document paths to copy. */
	paths: string[]
	recursive: boolean
	maxDocs: number
}

/**
 * Copies real documents into an anonymized snapshot on disk. Raw documents
 * stay in memory; only anonymized data (including the metadata) is written.
 * Reads stop at `maxDocs` to bound cost. The snapshot is written to a temp
 * directory and swapped in only on success.
 */
export async function exportSnapshot(input: ExportInput): Promise<SnapshotMeta> {
	const { connection, db } = await resolveTarget(input.conn, input.db)
	const { config } = await loadAnonymizeConfig()
	const anonymizer = new Anonymizer(config, await loadSalt())
	const finalDir = snapshotDir(input.name)

	const source: SnapshotSource = {
		listDocuments: (path, pageSize, pageToken) =>
			listDocumentsPage(connection, db, input.db, path, pageSize, pageToken),
		listCollections: async (docPath) =>
			(await db.doc(docPath).listCollections()).map((ref) => ref.id),
		getDocument: async (path) => {
			const snap = await db.doc(path).get()
			return snap.exists ? encodeSnapshot(snap) : null
		}
	}
	for (const raw of input.paths) {
		if (!isDocumentPath(normalizePath(raw))) requireCollectionPath(raw)
	}
	const { docs, truncated } = await withFirestoreErrors(() => collectDocuments(source, input))
	const anonymized = anonymizeDocuments(docs, anonymizer)

	const tempDir = join(snapshotsDir(), `.tmp-${input.name}-${process.pid}-${Date.now()}`)
	await mkdir(tempDir, { recursive: true, mode: 0o700 })
	try {
		const out = createWriteStream(join(tempDir, 'docs.ndjson'), { mode: 0o600 })
		try {
			for (const doc of anonymized) {
				if (!out.write(`${JSON.stringify(doc)}\n`)) await once(out, 'drain')
			}
		} finally {
			out.end()
			await once(out, 'close')
		}

		const meta: SnapshotMeta = {
			name: input.name,
			createdAt: new Date().toISOString(),
			source: {
				conn: connection.id,
				projectId: connection.projectId,
				db: input.db,
				paths: input.paths.map((p) => anonymizer.path(normalizePath(p)))
			},
			recursive: input.recursive,
			docCount: anonymized.length,
			truncated,
			anonymized: true
		}
		await writeMeta(meta, tempDir)
		await rm(finalDir, { recursive: true, force: true })
		await rename(tempDir, finalDir)
		return meta
	} catch (error) {
		await rm(tempDir, { recursive: true, force: true })
		throw error
	}
}
