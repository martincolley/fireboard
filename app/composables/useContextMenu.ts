import type { DropdownOption } from 'naive-ui'

export interface ContextMenuState {
	show: boolean
	x: number
	y: number
	options: DropdownOption[]
	onSelect: (key: string) => void
}

/** One app-wide right-click menu (rendered by WorkspaceContextMenu). */
export function useContextMenu() {
	const state = useState<ContextMenuState>('context-menu', () => ({
		show: false,
		x: 0,
		y: 0,
		options: [],
		onSelect: () => {}
	}))

	function openAt(event: MouseEvent, options: DropdownOption[], onSelect: (key: string) => void) {
		event.preventDefault()
		event.stopPropagation()
		state.value = { show: true, x: event.clientX, y: event.clientY, options, onSelect }
	}

	function close() {
		state.value = { ...state.value, show: false }
	}

	return { state, openAt, close }
}
