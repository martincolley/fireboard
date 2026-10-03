import type { FsDoc, FsFilter, FsOrder } from './firestore'

/** What the user currently has open in the Fireboard UI (reported by the UI, read over MCP). */
export interface ViewState {
	conn: string
	db: string
	path: string
	view: 'table' | 'tree' | 'json'
	group: boolean
	filters: FsFilter[]
	orderBy: FsOrder[]
	limit: number
	updatedAt: string
	/**
	 * Set by the hosted UI: the data it is showing. The local companion has no
	 * credentials for hosted connections, so MCP returns exactly what the user sees.
	 */
	results?: { documents: FsDoc[]; hasMore?: boolean; subcollections?: string[] }
	/** Where the view came from. */
	source?: 'local' | 'cloud'
}

/** Commands pushed from the server (e.g. an MCP client) to the open UI. */
export type UiCommand = { type: 'open'; conn: string; db: string; path: string }
