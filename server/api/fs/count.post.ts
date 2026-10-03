import { querySchema } from '../../local/fsSchemas'
import { countQuery } from '../../local/fsService'
export default defineEventHandler(async (event): Promise<{ count: number }> => {
	return { count: await countQuery(await readValidatedBody(event, querySchema.parse)) }
})
