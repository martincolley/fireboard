import type { DatabaseList } from '#shared/types/firestore'
import { getConnection } from '../../../local/connectionStore'
import { listDatabases } from '../../../local/firestoreClients'

export default defineEventHandler(async (event): Promise<DatabaseList> => {
	const connection = await getConnection(getRouterParam(event, 'id') ?? '')
	return listDatabases(connection)
})
