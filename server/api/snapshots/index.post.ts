import { z } from 'zod'
import type { SnapshotMeta } from '#shared/types/snapshot'
import { exportSnapshot } from '../../local/snapshots/exportSnapshot'
import { SNAPSHOT_NAME } from '../../local/snapshots/store'
import { targetSchema } from '../../local/fsSchemas'

const schema = targetSchema.extend({
	name: z.string().regex(SNAPSHOT_NAME, 'Use letters, numbers, dashes and underscores'),
	paths: z.array(z.string().min(1)).min(1),
	recursive: z.boolean().default(true),
	maxDocs: z.number().int().min(1).max(50_000).default(2000)
})

/** Creates an anonymized snapshot of real data. */
export default defineEventHandler(async (event): Promise<SnapshotMeta> => {
	return exportSnapshot(await readValidatedBody(event, schema.parse))
})
