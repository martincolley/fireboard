import type { FsFields, FsValue } from '../types/firestore'
import { isoToTimestamp, timestampToIso } from './timestamp'

/**
 * "Extended JSON": plain JSON that people can read and type, with special
 * Firestore types written as tagged objects (Firefoo-compatible):
 *   {"__time__": "2026-10-03T09:00:00.000000000Z"}
 *   {"__ref__": "users/abc"}
 *   {"__lat__": 1.5, "__lon__": 2.5}
 *   {"__bytes__": "base64..."}
 *   {"__vector__": [0.1, 0.2]}
 */
export type ExtJson = null | boolean | number | string | ExtJson[] | { [key: string]: ExtJson }

export function toExtJson(value: FsValue): ExtJson {
	switch (value.t) {
		case 'null':
			return null
		case 'boolean':
		case 'number':
		case 'string':
			return value.v
		case 'timestamp':
			return { __time__: timestampToIso(value.s, value.n) }
		case 'geopoint':
			return { __lat__: value.lat, __lon__: value.lng }
		case 'reference':
			return { __ref__: value.v }
		case 'bytes':
			return { __bytes__: value.v }
		case 'vector':
			return { __vector__: value.v }
		case 'array':
			return value.v.map(toExtJson)
		case 'map':
			return fieldsToExtJson(value.v)
	}
}

export function fieldsToExtJson(fields: FsFields): { [key: string]: ExtJson } {
	const out: { [key: string]: ExtJson } = {}
	for (const key of Object.keys(fields).sort()) out[key] = toExtJson(fields[key]!)
	return out
}

function isTagged(obj: Record<string, unknown>, ...keys: string[]): boolean {
	const own = Object.keys(obj)
	return own.length === keys.length && keys.every((k) => own.includes(k))
}

export function fromExtJson(json: unknown): FsValue {
	if (json === null || json === undefined) return { t: 'null' }
	if (typeof json === 'boolean') return { t: 'boolean', v: json }
	if (typeof json === 'number') return { t: 'number', v: json }
	if (typeof json === 'string') return { t: 'string', v: json }
	if (Array.isArray(json)) return { t: 'array', v: json.map(fromExtJson) }
	if (typeof json !== 'object') throw new Error(`Unsupported JSON value: ${String(json)}`)

	const obj = json as Record<string, unknown>
	if (isTagged(obj, '__time__') && typeof obj.__time__ === 'string') {
		return { t: 'timestamp', ...isoToTimestamp(obj.__time__) }
	}
	if (isTagged(obj, '__ref__') && typeof obj.__ref__ === 'string') {
		return { t: 'reference', v: obj.__ref__ }
	}
	if (isTagged(obj, '__lat__', '__lon__')) {
		return { t: 'geopoint', lat: Number(obj.__lat__), lng: Number(obj.__lon__) }
	}
	if (isTagged(obj, '__bytes__') && typeof obj.__bytes__ === 'string') {
		return { t: 'bytes', v: obj.__bytes__ }
	}
	if (isTagged(obj, '__vector__') && Array.isArray(obj.__vector__)) {
		return { t: 'vector', v: obj.__vector__.map(Number) }
	}
	return { t: 'map', v: fieldsFromExtJson(obj) }
}

export function fieldsFromExtJson(json: unknown): FsFields {
	if (!json || typeof json !== 'object' || Array.isArray(json)) {
		throw new Error('A document must be a JSON object')
	}
	const out: FsFields = {}
	for (const [key, value] of Object.entries(json)) out[key] = fromExtJson(value)
	return out
}
