import type { Connection } from '#shared/types/connection'
import { requireEntitled } from '../../../cloud/access'
import { cloudEnv } from '../../../cloud/env'
import { rowToConnection, type ProjectRow } from '../../../cloud/projects'

export default defineEventHandler(async (event): Promise<{ connections: Connection[] }> => {
	const { user } = await requireEntitled(event)
	const { results } = await cloudEnv(event)
		.DB.prepare('select * from "project" where "userId" = ? order by "name"')
		.bind(user.id)
		.all<ProjectRow>()
	return { connections: results.map(rowToConnection) }
})
