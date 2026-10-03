import { z } from 'zod'
import type { FsValue } from '../types/firestore'

/** Validates FsValue JSON from untrusted input (request bodies, imported files). */
export const fsValueSchema: z.ZodType<FsValue> = z.lazy(() =>
	z.discriminatedUnion('t', [
		z.object({ t: z.literal('null') }),
		z.object({ t: z.literal('boolean'), v: z.boolean() }),
		z.object({ t: z.literal('number'), v: z.number() }),
		z.object({ t: z.literal('string'), v: z.string() }),
		z.object({ t: z.literal('timestamp'), s: z.number().int(), n: z.number().int().min(0) }),
		z.object({ t: z.literal('geopoint'), lat: z.number(), lng: z.number() }),
		z.object({ t: z.literal('reference'), v: z.string().min(1) }),
		z.object({ t: z.literal('bytes'), v: z.string() }),
		z.object({ t: z.literal('vector'), v: z.array(z.number()) }),
		z.object({ t: z.literal('array'), v: z.array(fsValueSchema) }),
		z.object({ t: z.literal('map'), v: z.record(z.string(), fsValueSchema) })
	])
)

export const fsFieldsSchema = z.record(z.string(), fsValueSchema)
