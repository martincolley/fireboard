import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import type { Connection } from '#shared/types/connection'

export const connectionSchema = z.object({
	id: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes'),
	name: z.string().min(1).max(100),
	projectId: z.string().min(1).max(100),
	credential: z.discriminatedUnion('type', [
		z.object({ type: z.literal('serviceAccount'), path: z.string().min(1) }),
		z.object({ type: z.literal('adc') }),
		z.object({
			type: z.literal('emulator'),
			host: z
				.string()
				.regex(/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/, 'Emulator host must be localhost:<port>')
		})
	]),
	databases: z.array(z.string().min(1)).optional(),
	readOnly: z.boolean().optional(),
	color: z.string().max(32).optional()
}) satisfies z.ZodType<Connection>

const fileSchema = z.object({ connections: z.array(connectionSchema) })

/**
 * Connections live outside the repo (default ~/.config/fireboard/connections.json)
 * so credentials and project lists are never committed or served as static files.
 */
export function configPath(): string {
	return process.env.FIREBOARD_CONFIG || join(homedir(), '.config', 'fireboard', 'connections.json')
}

export async function loadConnections(): Promise<Connection[]> {
	let raw: string
	try {
		raw = await readFile(configPath(), 'utf8')
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
		throw error
	}
	return fileSchema.parse(JSON.parse(raw)).connections
}

export async function saveConnections(connections: Connection[]): Promise<void> {
	const path = configPath()
	await mkdir(dirname(path), { recursive: true, mode: 0o700 })
	await writeFile(path, `${JSON.stringify({ connections }, null, '\t')}\n`, { mode: 0o600 })
}

export async function getConnection(id: string): Promise<Connection> {
	const connection = (await loadConnections()).find((c) => c.id === id)
	if (!connection) {
		throw createError({ statusCode: 404, message: `Unknown connection "${id}"` })
	}
	return connection
}
