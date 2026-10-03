import type { FsQueryResult } from '#shared/types/firestore'
import { querySchema } from '../../local/fsSchemas'
import { runQuery } from '../../local/fsService'

export default defineEventHandler(async (event): Promise<FsQueryResult> => {
	return runQuery(await readValidatedBody(event, querySchema.parse))
})
