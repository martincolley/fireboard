import type { FsFilter, FsValue } from '#shared/types/firestore'
import type { FilterDraft, FilterValueType } from '~/composables/useTabs'

const LIST_OPS = new Set(['in', 'not-in', 'array-contains-any'])

/** Parses filter text: numbers, true/false/null and quoted strings are typed, anything else is a string. */
function parseAuto(raw: string): FsValue {
	const text = raw.trim()
	if (text === 'null') return { t: 'null' }
	if (text === 'true' || text === 'false') return { t: 'boolean', v: text === 'true' }
	if (text !== '' && !Number.isNaN(Number(text))) return { t: 'number', v: Number(text) }
	if (/^".*"$/.test(text)) return { t: 'string', v: JSON.parse(text) }
	return { t: 'string', v: raw }
}

function parseOne(raw: string, type: FilterValueType): FsValue {
	switch (type) {
		case 'auto':
			return parseAuto(raw)
		case 'string':
			return { t: 'string', v: raw }
		case 'number': {
			const v = Number(raw)
			if (Number.isNaN(v)) throw new Error(`"${raw}" is not a number`)
			return { t: 'number', v }
		}
		case 'boolean':
			return { t: 'boolean', v: raw.trim() === 'true' }
		case 'null':
			return { t: 'null' }
		case 'timestamp':
			return { t: 'timestamp', ...isoToTimestamp(raw) }
		case 'reference':
			return { t: 'reference', v: normalizePath(raw) }
	}
}

/** Converts the editable filter rows of a tab into API filters. List operators take comma-separated values. */
export function toFsFilter(draft: FilterDraft): FsFilter {
	const value: FsValue = LIST_OPS.has(draft.op)
		? { t: 'array', v: draft.raw.split(',').map((part) => parseOne(part.trim(), draft.type)) }
		: parseOne(draft.raw, draft.type)
	return { field: draft.field.trim(), op: draft.op, value }
}
