import { z } from 'zod'
import type { SnapshotLoadResult } from '#shared/types/snapshot'
import { loadSnapshot } from '../../local/snapshots/loadSnapshot'
import { targetSchema } from '../../local/fsSchemas'

const schema = targetSchema.extend({ name: z.string().min(1), wipe: z.boolean().default(false) })

/** Loads a snapshot into an emulator connection. */
export default defineEventHandler(async (event): Promise<SnapshotLoadResult> => {
	return loadSnapshot(await readValidatedBody(event, schema.parse))
})
