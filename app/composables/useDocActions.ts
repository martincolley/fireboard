import { useDialog, useMessage, type DropdownOption } from 'naive-ui'
import type { FsDoc } from '#shared/types/firestore'
import type { TabTarget } from './useTabs'

const divider = (key: string): DropdownOption => ({ type: 'divider', key })

/**
 * Right-click menus for documents and collections (Firefoo-style): open in
 * this or a new tab, edit, rename/move/duplicate/copy to another database,
 * export, copy ids and paths, and jump to the Firebase console.
 */
export function useDocActions() {
	const { openAt } = useContextMenu()
	const { openHere, openNew, active, persist } = useTabs()
	const { byId } = useConnections()
	const { ask } = useActionDialog()
	const { bump } = useDataVersion()
	const driverFor = useDriver()
	const message = useMessage()
	const dialog = useDialog()

	async function copy(text: string, what: string) {
		await navigator.clipboard.writeText(text)
		message.success(`${what} copied`)
	}

	function writable(target: TabTarget): boolean {
		return !byId(target.conn)?.readOnly
	}

	function external(target: TabTarget): boolean {
		return byId(target.conn)?.credential.type !== 'emulator'
	}

	/** The document's data: the one already loaded, or fetched now. */
	async function loadDoc(target: TabTarget, doc?: FsDoc | null): Promise<FsDoc | null> {
		if (doc) return doc
		return (await driverFor(target.conn).getDocument(target.db, target.path)).doc
	}

	function documentMenu(event: MouseEvent, target: TabTarget, doc?: FsDoc | null) {
		const canWrite = writable(target)
		const geopoints = doc ? findGeopoints(doc.fields) : []
		const options: DropdownOption[] = [
			{ key: 'open-here', label: 'Open in this tab' },
			{ key: 'open-new', label: 'Open in new tab' },
			{ key: 'edit-json', label: canWrite ? 'Edit document as JSON…' : 'View document as JSON' },
			divider('d1'),
			{ key: 'add-field', label: 'Add field…', disabled: !canWrite },
			{ key: 'add-subcollection', label: 'Add subcollection…', disabled: !canWrite },
			divider('d2'),
			{ key: 'rename', label: 'Rename document…', disabled: !canWrite },
			{ key: 'move', label: 'Move document to…', disabled: !canWrite },
			{ key: 'duplicate', label: 'Duplicate document…', disabled: !canWrite },
			{ key: 'copy-to', label: 'Copy document to…' },
			{ key: 'delete', label: 'Delete document…', disabled: !canWrite },
			divider('d3'),
			{
				key: 'map',
				label: geopoints.length ? 'Show geopoints on map' : 'Show geopoints on map (none)',
				disabled: !geopoints.length,
				...(geopoints.length > 1
					? {
							children: geopoints.slice(0, 10).map((g, i) => ({ key: `map:${i}`, label: g.field }))
						}
					: {})
			},
			{ key: 'export', label: 'Export document (JSON)' },
			{
				key: 'copy',
				label: 'Copy',
				children: [
					{ key: 'copy-id', label: 'Document id' },
					{ key: 'copy-path', label: 'Path' },
					{ key: 'copy-json', label: 'Fields as JSON' }
				]
			},
			divider('d4'),
			{ key: 'console', label: 'Reveal in Firebase console', disabled: !external(target) }
		]

		openAt(event, options, async (key) => {
			try {
				await runDocument(key, target, doc, geopoints)
			} catch (error) {
				message.error(apiErrorMessage(error), { duration: 10000 })
			}
		})
	}

	async function runDocument(
		key: string,
		target: TabTarget,
		doc: FsDoc | null | undefined,
		geopoints: ReturnType<typeof findGeopoints>
	) {
		const conn = byId(target.conn)
		if (key === 'open-here') return openHere(target)
		if (key === 'open-new') return openNew(target)
		if (key === 'edit-json') {
			openHere(target)
			if (active.value) {
				active.value.view = 'json'
				persist()
			}
			return
		}
		if (key === 'add-field') return ask({ kind: 'addField', target, doc })
		if (key === 'add-subcollection') return ask({ kind: 'addSubcollection', target, doc })
		if (key === 'rename' || key === 'move' || key === 'duplicate')
			return ask({ kind: key, target, doc })
		if (key === 'copy-to') return ask({ kind: 'copyTo', target, doc })
		if (key === 'delete') return confirmDelete(target)
		if (key === 'map' || key.startsWith('map:')) {
			const point = geopoints[key === 'map' ? 0 : Number(key.slice(4))]
			if (point)
				window.open(`https://www.google.com/maps?q=${point.lat},${point.lng}`, '_blank', 'noopener')
			return
		}
		if (key === 'export') {
			const data = await loadDoc(target, doc)
			if (!data) throw new Error('Document has no data')
			return downloadText(
				`${data.id}.json`,
				JSON.stringify({ path: data.path, fields: fieldsToExtJson(data.fields) }, null, 2)
			)
		}
		if (key === 'copy-id') return copy(lastSegment(target.path), 'Id')
		if (key === 'copy-path') return copy(target.path, 'Path')
		if (key === 'copy-json') {
			const data = await loadDoc(target, doc)
			return copy(JSON.stringify(fieldsToExtJson(data?.fields ?? {}), null, 2), 'JSON')
		}
		if (key === 'console' && conn) {
			window.open(consoleUrl(conn.projectId, target.db, target.path), '_blank', 'noopener')
		}
	}

	function confirmDelete(target: TabTarget) {
		dialog.warning({
			title: 'Delete document',
			content: `Delete ${target.path} and its subcollections from ${target.db}? This can't be undone.`,
			positiveText: 'Delete',
			negativeText: 'Cancel',
			onPositiveClick: async () => {
				try {
					await driverFor(target.conn).deleteDocument(target.db, target.path, true)
					message.success('Deleted')
					bump()
				} catch (error) {
					message.error(apiErrorMessage(error), { duration: 10000 })
				}
			}
		})
	}

	function collectionMenu(event: MouseEvent, target: TabTarget) {
		const canWrite = writable(target)
		const options: DropdownOption[] = [
			{ key: 'open-here', label: 'Open in this tab' },
			{ key: 'open-new', label: 'Open in new tab' },
			divider('c1'),
			{ key: 'import', label: 'Import documents (JSON)…', disabled: !canWrite },
			{ key: 'export', label: 'Export collection (JSON)' },
			{ key: 'copy-path', label: 'Copy path' },
			divider('c2'),
			{ key: 'console', label: 'Reveal in Firebase console', disabled: !external(target) },
			divider('c3'),
			{ key: 'delete', label: 'Delete collection…', disabled: !canWrite }
		]
		openAt(event, options, async (key) => {
			try {
				const conn = byId(target.conn)
				if (key === 'open-here') openHere(target)
				else if (key === 'open-new') openNew(target)
				else if (key === 'import') ask({ kind: 'import', target })
				else if (key === 'delete') ask({ kind: 'deleteCollection', target })
				else if (key === 'copy-path') await copy(target.path, 'Path')
				else if (key === 'console' && conn) {
					window.open(consoleUrl(conn.projectId, target.db, target.path), '_blank', 'noopener')
				} else if (key === 'export') {
					const docs = await listAllDocuments(driverFor(target.conn), target.db, target.path, 5000)
					const out: Record<string, unknown> = {}
					for (const doc of docs) if (!doc.missing) out[doc.id] = fieldsToExtJson(doc.fields)
					downloadText(`${lastSegment(target.path)}.json`, JSON.stringify(out, null, 2))
					message.success(`Exported ${Object.keys(out).length} document(s)`)
				}
			} catch (error) {
				message.error(apiErrorMessage(error), { duration: 10000 })
			}
		})
	}

	return { documentMenu, collectionMenu }
}
