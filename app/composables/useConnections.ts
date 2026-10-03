import type { Connection } from '#shared/types/connection'
import type { DatabaseList } from '#shared/types/firestore'

/**
 * Configured connections plus a per-connection database cache. Local build:
 * the server's connections file. Hosted build: the user's projects in D1.
 */
export function useConnections() {
	const { isCloud } = useMode()
	const connections = useState<Connection[]>('connections', () => [])
	const configPath = useState<string>('connections-config-path', () => '')
	const databases = useState<Record<string, DatabaseList>>('connection-databases', () => ({}))
	const base = isCloud ? '/api/cloud/projects' : '/api/connections'

	async function load() {
		const res = await api<{ connections: Connection[]; configPath?: string }>(base)
		connections.value = res.connections
		configPath.value = res.configPath ?? ''
	}

	async function save(connection: Connection) {
		await api(base, { method: 'POST', body: connection })
		delete databases.value[connection.id]
		await load()
	}

	async function remove(id: string) {
		await api(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' })
		delete databases.value[id]
		await load()
	}

	function byId(id: string): Connection | undefined {
		return connections.value.find((c) => c.id === id)
	}

	return { connections, configPath, databases, load, save, remove, byId }
}

/** Database list for a connection, cached; `force` re-fetches. */
export function useDatabases() {
	const { databases } = useConnections()
	const driverFor = useDriver()
	return async function loadDatabases(id: string, force = false): Promise<DatabaseList> {
		if (!force && databases.value[id]) return databases.value[id]
		const list = await driverFor(id).listDatabases()
		databases.value[id] = list
		return list
	}
}
