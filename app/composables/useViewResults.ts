import type { FsDoc } from '#shared/types/firestore'

export interface ViewResults {
	documents: FsDoc[]
	hasMore?: boolean
	subcollections?: string[]
}

/** What each tab is currently showing (used to share the hosted view with a local MCP companion). */
export function useViewResults() {
	return useState<Record<string, ViewResults>>('view-results', () => ({}))
}
