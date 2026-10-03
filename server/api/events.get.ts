import { addUiStream } from '../local/liveView'
/** Server-sent events stream the UI listens on for commands (e.g. MCP "open in Fireboard"). */
export default defineEventHandler(async (event) => {
	const stream = createEventStream(event)
	addUiStream(stream)
	return stream.send()
})
