import { z } from 'zod'
import type { FsDoc } from '#shared/types/firestore'
import { fsFieldsSchema, targetSchema } from '../../local/fsSchemas'
import { setDocument } from '../../local/fsService'

const schema = targetSchema.extend({
	path: z.string().min(1),
	fields: fsFieldsSchema,
	/** `replace` overwrites the whole document, `merge` only touches the given fields. */
	mode: z.enum(['replace', 'merge']).default('replace')
})

export default defineEventHandler(async (event): Promise<FsDoc> => {
	const input = await readValidatedBody(event, schema.parse)
	return setDocument(input.conn, input.db, input.path, input.fields, input.mode)
})
