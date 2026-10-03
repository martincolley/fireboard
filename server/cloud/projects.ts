import { z } from 'zod'
import type { Connection } from '#shared/types/connection'

/** A cloud project row. Only google (browser sign-in) and emulator credentials exist in the cloud. */
export const cloudProjectSchema = z.object({
	id: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9][a-z0-9-]*$/),
	name: z.string().min(1).max(100),
	projectId: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9-]+$/, 'Invalid Google Cloud project id'),
	credential: z.discriminatedUnion('type', [
		z.object({ type: z.literal('google') }),
		z.object({
			type: z.literal('emulator'),
			host: z
				.string()
				.regex(/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/, 'Emulator host must be localhost:<port>')
		})
	]),
	databases: z.array(z.string().min(1).max(100)).max(50).optional(),
	readOnly: z.boolean().optional(),
	color: z.string().max(32).optional()
})

export interface ProjectRow {
	id: string
	name: string
	projectId: string
	credentialType: 'google' | 'emulator'
	emulatorHost: string | null
	databases: string | null
	readOnly: number
	color: string | null
}

export function rowToConnection(row: ProjectRow): Connection {
	return {
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		credential:
			row.credentialType === 'emulator'
				? { type: 'emulator', host: row.emulatorHost ?? '' }
				: { type: 'google' },
		databases: row.databases ? JSON.parse(row.databases) : undefined,
		readOnly: Boolean(row.readOnly) || undefined,
		color: row.color ?? undefined
	}
}
