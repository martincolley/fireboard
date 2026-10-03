import { z } from 'zod'

import { fsFieldsSchema, fsValueSchema } from '#shared/schemas/fsValue'

export { fsFieldsSchema, fsValueSchema }

export const targetSchema = z.object({
	conn: z.string().min(1),
	db: z.string().min(1)
})

const filterOps = [
	'==',
	'!=',
	'<',
	'<=',
	'>',
	'>=',
	'array-contains',
	'array-contains-any',
	'in',
	'not-in'
] as const

export const querySchema = targetSchema.extend({
	path: z.string().min(1),
	group: z.boolean().optional(),
	filters: z
		.array(z.object({ field: z.string().min(1), op: z.enum(filterOps), value: fsValueSchema }))
		.optional(),
	orderBy: z.array(z.object({ field: z.string().min(1), dir: z.enum(['asc', 'desc']) })).optional(),
	limit: z.number().int().min(1).max(1000).optional(),
	startAfter: z.string().optional(),
	pageToken: z.string().optional()
})
