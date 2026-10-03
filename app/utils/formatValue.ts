import type { FsType, FsValue } from '#shared/types/firestore'

export const TYPE_LABELS: Record<FsType, string> = {
	null: 'Null',
	boolean: 'Boolean',
	number: 'Number',
	string: 'String',
	timestamp: 'Timestamp',
	geopoint: 'GeoPoint',
	reference: 'Reference',
	bytes: 'Bytes',
	vector: 'Vector',
	array: 'Array',
	map: 'Map'
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'medium'
})

export function formatTimestamp(s: number, n: number): string {
	return dateFormat.format(new Date(s * 1000 + Math.floor(n / 1e6)))
}

/** One-line summary of a value, like Firefoo's value column. */
export function summarize(value: FsValue, maxLength = 200): string {
	const text = summarizeInner(value, 0)
	return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function summarizeInner(value: FsValue, depth: number): string {
	switch (value.t) {
		case 'null':
			return 'null'
		case 'boolean':
		case 'number':
			return String(value.v)
		case 'string':
			return depth === 0 ? value.v : JSON.stringify(value.v)
		case 'timestamp':
			return formatTimestamp(value.s, value.n)
		case 'geopoint':
			return `[${value.lat}° , ${value.lng}°]`
		case 'reference':
			return value.v
		case 'bytes':
			return `<${Math.floor((value.v.length * 3) / 4)} bytes>`
		case 'vector':
			return `<vector ${value.v.length}>`
		case 'array':
			if (depth > 2) return `[${value.v.length}]`
			return `[${value.v.map((item) => summarizeInner(item, depth + 1)).join(', ')}]`
		case 'map': {
			if (depth > 2) return '{…}'
			const entries = Object.keys(value.v)
				.sort()
				.map((key) => `${key}: ${summarizeInner(value.v[key]!, depth + 1)}`)
			return `{${entries.join(', ')}}`
		}
	}
}

export function isContainer(value: FsValue): value is Extract<FsValue, { t: 'array' | 'map' }> {
	return value.t === 'array' || value.t === 'map'
}

/** Sort keys of a map for stable display. */
export function sortedEntries(fields: Record<string, FsValue>): [string, FsValue][] {
	return Object.keys(fields)
		.sort((a, b) => a.localeCompare(b))
		.map((key) => [key, fields[key]!])
}
