import { z } from 'zod'
import type { FsDocResult } from '#shared/types/firestore'
import { targetSchema } from '../../local/fsSchemas'
import { getDocument } from '../../local/fsService'

const schema = targetSchema.extend({ path: z.string().min(1) })

export default defineEventHandler(async (event): Promise<FsDocResult> => {
	const input = await getValidatedQuery(event, schema.parse)
	return getDocument(input.conn, input.db, input.path)
})
