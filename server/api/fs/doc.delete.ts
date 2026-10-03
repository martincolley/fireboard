import { z } from 'zod'
import { targetSchema } from '../../local/fsSchemas'
import { deleteDocument } from '../../local/fsService'

const schema = targetSchema.extend({
	path: z.string().min(1),
	/** Also delete every subcollection under the document. */
	recursive: z.boolean().default(false)
})

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
	const input = await readValidatedBody(event, schema.parse)
	await deleteDocument(input.conn, input.db, input.path, input.recursive)
	return { ok: true }
})
