import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { configPath } from '../../local/connectionStore'

const keySchema = z.object({
	type: z.literal('service_account'),
	project_id: z.string().min(1),
	client_email: z.string().min(1),
	private_key: z.string().min(1)
})

/**
 * Stores an uploaded service account key next to the connections config
 * (mode 600) so the browser never needs to know a filesystem path.
 * Returns the stored path and the key's project id; the key is never echoed back.
 */
export default defineEventHandler(async (event): Promise<{ path: string; projectId: string }> => {
	const body = await readBody(event)
	const parsed = keySchema.safeParse(body)
	if (!parsed.success) {
		throw createError({ statusCode: 400, message: 'Not a Google service account key file' })
	}
	const key = parsed.data
	const suffix = createHash('sha256').update(key.client_email).digest('hex').slice(0, 8)
	const dir = join(dirname(configPath()), 'keys')
	const path = join(dir, `${key.project_id.replace(/[^a-zA-Z0-9-]/g, '_')}-${suffix}.json`)

	await mkdir(dir, { recursive: true, mode: 0o700 })
	await writeFile(path, JSON.stringify(body, null, '\t'), { mode: 0o600 })
	return { path, projectId: key.project_id }
})
