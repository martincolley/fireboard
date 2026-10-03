import { z } from 'zod'
import { fsFieldsSchema, querySchema, targetSchema } from '../local/fsSchemas'
import { setCurrentView } from '../local/liveView'

const schema = targetSchema.extend({
	path: z.string(),
	view: z.enum(['table', 'tree', 'json']),
	group: z.boolean(),
	filters: querySchema.shape.filters.unwrap(),
	orderBy: querySchema.shape.orderBy.unwrap(),
	limit: z.number().int().min(1).max(1000),
	source: z.enum(['local', 'cloud']).optional(),
	results: z
		.object({
			documents: z
				.array(
					z.object({
						id: z.string(),
						path: z.string(),
						createTime: z.string().optional(),
						updateTime: z.string().optional(),
						fields: fsFieldsSchema,
						missing: z.boolean().optional()
					})
				)
				.max(200),
			hasMore: z.boolean().optional(),
			subcollections: z.array(z.string()).optional()
		})
		.optional()
})

/** The UI reports the active tab so MCP clients can see what the user is looking at. */
const MAX_BODY_BYTES = 2_000_000

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
	const length = Number(getRequestHeader(event, 'content-length') ?? 0)
	if (!length || length > MAX_BODY_BYTES) {
		throw createError({ statusCode: 413, message: 'View report too large (or missing length)' })
	}
	const input = await readValidatedBody(event, schema.parse)
	// Cross-origin reports can only come from the hosted app through the bridge: never let them
	// claim to be local, or MCP would answer them from this machine's connections.
	const origin = getRequestHeader(event, 'origin')
	const crossOrigin = Boolean(origin) && origin !== getRequestURL(event).origin
	if (crossOrigin) input.source = 'cloud'
	setCurrentView({ ...input, updatedAt: new Date().toISOString() })
	return { ok: true }
})
