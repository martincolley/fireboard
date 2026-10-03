import type { FsDoc } from '#shared/types/firestore'
import type { TabTarget } from './useTabs'

export type ActionKind =
	| 'rename'
	| 'move'
	| 'duplicate'
	| 'copyTo'
	| 'addSubcollection'
	| 'addField'
	| 'import'
	| 'deleteCollection'

export interface ActionRequest {
	kind: ActionKind
	target: TabTarget
	doc?: FsDoc | null
}

/** The dialog that collects input for a context-menu action (rendered by BrowserActionDialog). */
export function useActionDialog() {
	const request = useState<ActionRequest | null>('action-dialog', () => null)
	return {
		request,
		ask: (next: ActionRequest) => (request.value = next),
		close: () => (request.value = null)
	}
}

/**
 * Bumped after any write from a dialog or menu, so open views reload.
 * `tree: true` also reloads the sidebar (collections added/removed, Google reconnected).
 */
export function useDataVersion() {
	const version = useState('data-version', () => 0)
	const treeVersion = useState('tree-version', () => 0)
	return {
		version,
		treeVersion,
		bump: (options: { tree?: boolean } = {}) => {
			version.value++
			if (options.tree) treeVersion.value++
		}
	}
}
