import type { SnapshotMeta } from '#shared/types/snapshot'
import { listSnapshots } from '../../local/snapshots/store'

export default defineEventHandler(async (): Promise<SnapshotMeta[]> => listSnapshots())
