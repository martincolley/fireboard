import { z } from 'zod'
import { targetSchema } from '../../local/fsSchemas'
import { listCollectionIds } from '../../local/fsService'

const schema = targetSchema.extend({ path: z.string().optional() })

/** Root collections when `path` is empty, otherwise subcollections of the document at `path`. */
export default defineEventHandler(async (event): Promise<{ collections: string[] }> => {
	const input = await getValidatedQuery(event, schema.parse)
	return { collections: await listCollectionIds(input.conn, input.db, input.path || undefined) }
})
