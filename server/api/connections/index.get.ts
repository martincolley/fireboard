import type { Connection } from '#shared/types/connection'
import { configPath, loadConnections } from '../../local/connectionStore'

export default defineEventHandler(
	async (): Promise<{ connections: Connection[]; configPath: string }> => {
		return { connections: await loadConnections(), configPath: configPath() }
	}
)
