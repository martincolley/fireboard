import type { SnapshotLoadResult, SnapshotMeta } from '#shared/types/snapshot'
import {
	exportInBrowser,
	importNdjson,
	loadInBrowser,
	toNdjson
} from '~/snapshots/browserSnapshots'
import { snapshotStore } from '~/snapshots/idb'

export interface CreateSnapshotInput {
	name: string
	conn: string
	db: string
	paths: string[]
	recursive: boolean
	maxDocs: number
}

/**
 * Anonymized snapshots of real data, and loading them into emulator
 * connections. Local build: stored by the local server on disk. Hosted build:
 * built and stored in this browser (IndexedDB), never on Fireboard's servers.
 */
export function useSnapshots() {
	const { isCloud } = useMode()
	const { byId } = useConnections()
	const google = useGoogleAuth()
	const snapshots = useState<SnapshotMeta[]>('snapshots', () => [])

	function connection(id: string) {
		const found = byId(id)
		if (!found) throw new Error(`Unknown connection "${id}"`)
		return found
	}

	async function load() {
		snapshots.value = isCloud
			? await snapshotStore.list()
			: await api<SnapshotMeta[]>('/api/snapshots')
	}

	async function create(input: CreateSnapshotInput): Promise<SnapshotMeta> {
		const meta = isCloud
			? await exportInBrowser({
					...input,
					connection: connection(input.conn),
					getGoogleToken: google.getToken
				})
			: await api<SnapshotMeta>('/api/snapshots', { method: 'POST', body: input })
		await load()
		return meta
	}

	function loadInto(input: {
		name: string
		conn: string
		db: string
		wipe: boolean
	}): Promise<SnapshotLoadResult> {
		return isCloud
			? loadInBrowser(input.name, connection(input.conn), input.db, input.wipe)
			: api<SnapshotLoadResult>('/api/snapshots/load', { method: 'POST', body: input })
	}

	async function remove(name: string) {
		if (isCloud) await snapshotStore.remove(name)
		else await api(`/api/snapshots/${encodeURIComponent(name)}`, { method: 'DELETE' })
		await load()
	}

	/** Hosted build: save a snapshot as a file (to keep, or to share with a teammate). */
	async function download(name: string) {
		const snapshot = await snapshotStore.get(name)
		if (!snapshot) throw new Error(`Snapshot "${name}" not found`)
		const url = URL.createObjectURL(toNdjson(snapshot))
		const link = document.createElement('a')
		link.href = url
		link.download = `${name}.fireboard.ndjson`
		link.click()
		// Revoking immediately can cancel the download in some browsers.
		setTimeout(() => URL.revokeObjectURL(url), 30_000)
	}

	async function importFile(file: File) {
		const meta = await importNdjson(await file.text())
		await load()
		return meta
	}

	return { snapshots, load, create, loadInto, remove, download, importFile, canTransfer: isCloud }
}
