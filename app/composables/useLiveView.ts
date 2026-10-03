import type { UiCommand } from '#shared/types/view'
import type { BrowserTab } from './useTabs'

/** Filters that fail to parse are skipped rather than blocking the report. */
function reportableFilters(tab: BrowserTab) {
	return tab.query.filters.flatMap((draft) => {
		if (!draft.field.trim()) return []
		try {
			return [toFsFilter(draft)]
		} catch {
			return []
		}
	})
}

const MAX_SHARED_DOCS = 100

/**
 * Keeps the MCP side informed of the active tab (so MCP clients can "see" it)
 * and applies commands pushed back (e.g. open a document).
 *
 * Local build: talks to its own server. Hosted build: only when the user opts
 * in, talks to a local companion on 127.0.0.1 and includes the visible results,
 * because the companion has no credentials for hosted connections.
 */
export function useLiveView() {
	const { isCloud } = useMode()
	const companion = useCompanion()
	const results = useViewResults()
	const { active, open } = useTabs()
	let timer: ReturnType<typeof setTimeout> | undefined
	let source: EventSource | undefined

	const base = computed(() => (isCloud ? (companion.enabled.value ? companion.url : null) : ''))

	function report(tab: BrowserTab) {
		if (base.value === null) return
		const shared = isCloud ? results.value[tab.id] : undefined
		$fetch(`${base.value}/api/view`, {
			method: 'POST',
			headers: { 'x-fireboard': '1' },
			body: {
				conn: tab.conn,
				db: tab.db,
				path: tab.path,
				view: tab.view,
				group: tab.query.group,
				filters: reportableFilters(tab),
				orderBy: tab.query.orderBy.filter((o) => o.field.trim()),
				limit: tab.query.limit,
				source: isCloud ? 'cloud' : 'local',
				results: shared
					? { ...shared, documents: shared.documents.slice(0, MAX_SHARED_DOCS) }
					: undefined
			}
		}).catch(() => {
			// Reporting is best effort (the companion may not be running).
		})
	}

	function connectEvents() {
		source?.close()
		source = undefined
		if (base.value === null) return
		source = new EventSource(`${base.value}/api/events`)
		source.addEventListener('command', (event) => {
			const command = JSON.parse((event as MessageEvent).data) as UiCommand
			if (command.type === 'open') open({ conn: command.conn, db: command.db, path: command.path })
		})
	}

	watch(
		[active, results, base],
		([tab]) => {
			clearTimeout(timer)
			if (tab) timer = setTimeout(() => report(tab), 300)
		},
		{ deep: true, immediate: true }
	)

	watch(base, connectEvents)
	onMounted(connectEvents)
	onBeforeUnmount(() => source?.close())
}
