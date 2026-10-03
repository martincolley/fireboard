import type { EventStream } from 'h3'
import type { UiCommand, ViewState } from '#shared/types/view'

/**
 * In-memory bridge between the browser UI and MCP clients: the UI reports what
 * it is showing, MCP tools read that and can push "open this" commands back.
 */
let currentView: ViewState | null = null
const streams = new Set<EventStream>()

export function setCurrentView(view: ViewState): void {
	currentView = view
}

export function getCurrentView(): ViewState | null {
	return currentView
}

export function addUiStream(stream: EventStream): void {
	streams.add(stream)
	stream.onClosed(() => streams.delete(stream))
}

/** Sends a command to every open UI. Returns how many UIs received it. */
export async function pushUiCommand(command: UiCommand): Promise<number> {
	const data = JSON.stringify(command)
	await Promise.all([...streams].map((stream) => stream.push({ event: 'command', data })))
	return streams.size
}
