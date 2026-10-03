import type { FsDoc } from '#shared/types/firestore'
import { fieldsToExtJson } from '#shared/utils/extJson'
import { errorMessage } from '../local/firestoreClients'

/** Hard cap on tool output so a huge document can't flood the model's context. */
const MAX_CHARS = 60_000

export function docToJson(doc: FsDoc) {
	return {
		path: doc.path,
		...(doc.missing ? { missing: true } : {}),
		...(doc.updateTime ? { updateTime: doc.updateTime } : {}),
		fields: fieldsToExtJson(doc.fields)
	}
}

export function jsonResult(value: unknown) {
	let text = JSON.stringify(value, null, 1)
	if (text.length > MAX_CHARS) {
		text = `${text.slice(0, MAX_CHARS)}\n... [truncated: ${text.length} chars total. Narrow the query or lower the limit.]`
	}
	return { content: [{ type: 'text' as const, text }] }
}

export function errorResult(error: unknown) {
	return {
		isError: true,
		content: [{ type: 'text' as const, text: errorMessage(error) }]
	}
}
