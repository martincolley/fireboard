import { z } from 'zod'
import type { FsDoc } from '#shared/types/firestore'
import { fsValueSchema, targetSchema } from '../../local/fsSchemas'
import { updateField } from '../../local/fsService'

const schema = targetSchema.extend({
	path: z.string().min(1),
	/** Field path segments, e.g. ["address", "city"]. Segments may contain dots. */
	field: z.array(z.string().min(1)).min(1),
	/** Omit to delete the field. */
	value: fsValueSchema.optional()
})

/** Updates (or deletes) a single field without touching the rest of the document. */
export default defineEventHandler(async (event): Promise<FsDoc> => {
	const input = await readValidatedBody(event, schema.parse)
	return updateField(input.conn, input.db, input.path, input.field, input.value)
})
