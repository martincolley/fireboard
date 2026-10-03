export interface SnapshotMeta {
	name: string
	createdAt: string
	source: { conn: string; projectId: string; db: string; paths: string[] }
	recursive: boolean
	docCount: number
	/** True when the max-docs budget stopped the export early. */
	truncated: boolean
	anonymized: true
}

export interface SnapshotLoadResult {
	written: number
	failed: number
	/** First few failure messages. */
	errors: string[]
	wiped: boolean
}
