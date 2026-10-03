import { requireEntitled } from '../../../cloud/access'
import { cloudEnv } from '../../../cloud/env'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
	const { user } = await requireEntitled(event)
	await cloudEnv(event)
		.DB.prepare('delete from "project" where "id" = ? and "userId" = ?')
		.bind(getRouterParam(event, 'id') ?? '', user.id)
		.run()
	return { ok: true }
})
