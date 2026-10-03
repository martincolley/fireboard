import { z } from 'zod'
import type { FsDoc } from '#shared/types/firestore'
import { fsFieldsSchema, targetSchema } from '../../local/fsSchemas'
import { createDocument } from '../../local/fsService'

const schema = targetSchema.extend({
	collection: z.string().min(1),
	/** Leave empty for an auto-generated id. */
	id: z.string().optional(),
	fields: fsFieldsSchema
})

/** Creates a new document; fails if the id already exists. */
export default defineEventHandler(async (event): Promise<FsDoc> => {
	const input = await readValidatedBody(event, schema.parse)
	return createDocument(input.conn, input.db, input.collection, input.id || undefined, input.fields)
})
