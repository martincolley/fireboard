import { loadConnections, saveConnections } from '../../local/connectionStore'
import { evictConnection } from '../../local/firestoreClients'
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
	const id = getRouterParam(event, 'id')
	const connections = await loadConnections()
	await saveConnections(connections.filter((c) => c.id !== id))
	if (id) await evictConnection(id)
	return { ok: true }
})
