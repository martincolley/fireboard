import { deleteSnapshot } from '../../local/snapshots/store'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
	await deleteSnapshot(getRouterParam(event, 'name') ?? '')
	return { ok: true }
})
