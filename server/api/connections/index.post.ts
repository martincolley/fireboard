import { access } from 'node:fs/promises'
import type { Connection } from '#shared/types/connection'
import { connectionSchema, loadConnections, saveConnections } from '../../local/connectionStore'
import { evictConnection } from '../../local/firestoreClients'

/** Creates or replaces a connection (matched by id). */
export default defineEventHandler(async (event): Promise<Connection> => {
	const input = await readValidatedBody(event, connectionSchema.parse)
	if (input.credential.type === 'serviceAccount') {
		try {
			await access(input.credential.path)
		} catch {
			throw createError({
				statusCode: 400,
				message: `Service account file not found: ${input.credential.path}`
			})
		}
	}
	const connections = await loadConnections()
	const index = connections.findIndex((c) => c.id === input.id)
	const previous = connections[index]
	if (index === -1) connections.push(input)
	else connections[index] = input
	await saveConnections(connections)
	// Only drop cached clients when what they connect to changed (not for a rename or colour).
	const target = (c: Connection) => JSON.stringify([c.projectId, c.credential])
	if (previous && target(previous) !== target(input)) await evictConnection(input.id)
	return input
})
