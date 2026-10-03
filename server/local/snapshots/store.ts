import { createReadStream } from 'node:fs'
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import type { FsFields } from '#shared/types/firestore'
import type { SnapshotMeta } from '#shared/types/snapshot'
import { configPath } from '../connectionStore'

/** Snapshots: ~/.config/fireboard/snapshots/<name>/{meta.json,docs.ndjson}. Already anonymized. */
export function snapshotsDir(): string {
	return join(dirname(configPath()), 'snapshots')
}

export const SNAPSHOT_NAME = /^[a-z0-9][a-z0-9_-]{0,79}$/i

export function snapshotDir(name: string): string {
	if (!SNAPSHOT_NAME.test(name)) {
		throw createError({ statusCode: 400, message: `Invalid snapshot name "${name}"` })
	}
	return join(snapshotsDir(), name)
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
	await mkdir(snapshotsDir(), { recursive: true, mode: 0o700 })
	const names = await readdir(snapshotsDir())
	const metas = await Promise.all(
		names.map(async (name) => {
			try {
				return JSON.parse(
					await readFile(join(snapshotsDir(), name, 'meta.json'), 'utf8')
				) as SnapshotMeta
			} catch {
				return null
			}
		})
	)
	return metas
		.filter((m): m is SnapshotMeta => m !== null)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function writeMeta(meta: SnapshotMeta, dir = snapshotDir(meta.name)): Promise<void> {
	await writeFile(join(dir, 'meta.json'), `${JSON.stringify(meta, null, '\t')}\n`, {
		mode: 0o600
	})
}

export async function readMeta(name: string): Promise<SnapshotMeta> {
	try {
		return JSON.parse(await readFile(join(snapshotDir(name), 'meta.json'), 'utf8'))
	} catch {
		throw createError({ statusCode: 404, message: `Snapshot "${name}" not found` })
	}
}

export async function* readSnapshotDocs(
	name: string
): AsyncGenerator<{ path: string; fields: FsFields }> {
	const lines = createInterface({ input: createReadStream(join(snapshotDir(name), 'docs.ndjson')) })
	for await (const line of lines) {
		if (line.trim()) yield JSON.parse(line)
	}
}

export async function deleteSnapshot(name: string): Promise<void> {
	await rm(snapshotDir(name), { recursive: true, force: true })
}

/** Throws a 404 unless the snapshot's data file exists. */
export async function assertSnapshotData(name: string): Promise<void> {
	try {
		await access(join(snapshotDir(name), 'docs.ndjson'))
	} catch {
		throw createError({ statusCode: 404, message: `Snapshot "${name}" has no data file` })
	}
}
