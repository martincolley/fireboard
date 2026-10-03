import type { FsFilterOp, FsOrder } from '#shared/types/firestore'

export type ViewMode = 'table' | 'tree' | 'json'

/** How a filter's raw text is turned into a Firestore value. */
export type FilterValueType =
	| 'auto'
	| 'string'
	| 'number'
	| 'boolean'
	| 'null'
	| 'timestamp'
	| 'reference'

export interface FilterDraft {
	field: string
	op: FsFilterOp
	type: FilterValueType
	raw: string
}

export interface TabQuery {
	group: boolean
	filters: FilterDraft[]
	orderBy: FsOrder[]
	limit: number
}

/** Where a tab points: connection, database and path. */
export interface TabTarget {
	conn: string
	db: string
	path: string
}

export interface BrowserTab {
	id: string
	conn: string
	db: string
	path: string
	view: ViewMode
	query: TabQuery
	history: TabTarget[]
}

const STORAGE_KEY = 'fireboard:tabs'

export function emptyQuery(): TabQuery {
	return { group: false, filters: [], orderBy: [], limit: 50 }
}

function readStored(): { tabs: BrowserTab[]; active: string | null } {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (raw) {
			const stored = JSON.parse(raw) as { tabs: BrowserTab[]; active: string | null }
			// Older versions kept history as plain paths.
			for (const tab of stored.tabs) {
				tab.history = (tab.history as unknown[]).map((entry) =>
					typeof entry === 'string'
						? { conn: tab.conn, db: tab.db, path: entry }
						: (entry as TabTarget)
				)
			}
			return stored
		}
	} catch {
		// Storage unavailable or corrupt: start fresh.
	}
	return { tabs: [], active: null }
}

/** Open browser tabs (each pinned to one connection + database), persisted locally. */
export function useTabs() {
	const tabs = useState<BrowserTab[]>('tabs', () => readStored().tabs)
	const activeId = useState<string | null>('active-tab', () => readStored().active)

	const active = computed(() => tabs.value.find((t) => t.id === activeId.value) ?? null)

	function persist() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ tabs: tabs.value, active: activeId.value })
			)
		} catch {
			// Non-essential.
		}
	}

	function open(target: { conn: string; db: string; path: string }) {
		const path = normalizePath(target.path)
		const existing = tabs.value.find(
			(t) => t.conn === target.conn && t.db === target.db && t.path === path
		)
		if (existing) {
			activeId.value = existing.id
		} else {
			const tab: BrowserTab = {
				id: crypto.randomUUID(),
				...target,
				path,
				view: 'table',
				query: emptyQuery(),
				history: []
			}
			tabs.value.push(tab)
			activeId.value = tab.id
		}
		persist()
	}

	/** Points a tab somewhere else (any connection/database), keeping a back stack. */
	function retarget(tab: BrowserTab, target: TabTarget) {
		const path = normalizePath(target.path)
		if (path === tab.path && target.conn === tab.conn && target.db === tab.db) return
		tab.history.push({ conn: tab.conn, db: tab.db, path: tab.path })
		tab.conn = target.conn
		tab.db = target.db
		tab.path = path
		tab.query = emptyQuery()
		persist()
	}

	/** Navigates the given tab to a new path in the same database. */
	function navigate(tab: BrowserTab, path: string) {
		retarget(tab, { conn: tab.conn, db: tab.db, path })
	}

	/** Opens a target in the active tab (or a new tab when none is open). */
	function openHere(target: TabTarget) {
		const tab = tabs.value.find((t) => t.id === activeId.value)
		if (tab) retarget(tab, target)
		else open(target)
	}

	/** Always opens a new tab, even if one already shows this target. */
	function openNew(target: TabTarget) {
		const tab: BrowserTab = {
			id: crypto.randomUUID(),
			...target,
			path: normalizePath(target.path),
			view: 'table',
			query: emptyQuery(),
			history: []
		}
		tabs.value.push(tab)
		activeId.value = tab.id
		persist()
	}

	function back(tab: BrowserTab) {
		const previous = tab.history.pop()
		if (previous === undefined) return
		tab.conn = previous.conn
		tab.db = previous.db
		tab.path = previous.path
		tab.query = emptyQuery()
		persist()
	}

	function close(id: string) {
		const index = tabs.value.findIndex((t) => t.id === id)
		if (index === -1) return
		tabs.value.splice(index, 1)
		if (activeId.value === id) {
			activeId.value = tabs.value[Math.min(index, tabs.value.length - 1)]?.id ?? null
		}
		persist()
	}

	function activate(id: string) {
		activeId.value = id
		persist()
	}

	return {
		tabs,
		activeId,
		active,
		open,
		openHere,
		openNew,
		navigate,
		retarget,
		back,
		close,
		activate,
		persist
	}
}
