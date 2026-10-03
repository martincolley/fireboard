import type { FsFields, FsType, FsValue } from '#shared/types/firestore'

/** Path to a value inside a document: map keys are strings, array indexes numbers. */
export type ValuePath = (string | number)[]

/** Returns `container` with the value at `path` replaced (or removed when `next` is undefined). */
export function setIn(container: FsValue, path: ValuePath, next: FsValue | undefined): FsValue {
	if (path.length === 0) return next ?? { t: 'null' }
	const [head, ...rest] = path
	if (container.t === 'map' && typeof head === 'string') {
		const v = { ...container.v }
		if (rest.length === 0 && next === undefined) delete v[head]
		else v[head] = setIn(v[head] ?? { t: 'map', v: {} }, rest, next)
		return { t: 'map', v }
	}
	if (container.t === 'array' && typeof head === 'number') {
		const v = [...container.v]
		if (rest.length === 0 && next === undefined) v.splice(head, 1)
		else v[head] = setIn(v[head] ?? { t: 'null' }, rest, next)
		return { t: 'array', v }
	}
	throw new Error(`Cannot address ${String(head)} inside a ${container.t}`)
}

export interface FieldUpdate {
	/** Field path for a Firestore update (all string segments). */
	field: string[]
	/** New value, or undefined to delete the field. */
	value: FsValue | undefined
}

/**
 * Turns an edit at an arbitrary path into a Firestore field update. Firestore can
 * address nested map keys but not array elements, so an edit inside an array
 * rewrites the nearest field above that array.
 */
export function toFieldUpdate(
	fields: FsFields,
	path: ValuePath,
	next: FsValue | undefined
): FieldUpdate {
	const arrayIndex = path.findIndex((segment) => typeof segment === 'number')
	if (arrayIndex === -1) return { field: path as string[], value: next }

	const fieldPath = path.slice(0, arrayIndex) as string[]
	const current = getIn({ t: 'map', v: fields }, fieldPath)
	if (!current) throw new Error(`Field ${fieldPath.join('.')} not found`)
	return { field: fieldPath, value: setIn(current, path.slice(arrayIndex), next) }
}

export function getIn(value: FsValue, path: ValuePath): FsValue | undefined {
	let current: FsValue | undefined = value
	for (const segment of path) {
		if (current?.t === 'map' && typeof segment === 'string') current = current.v[segment]
		else if (current?.t === 'array' && typeof segment === 'number') current = current.v[segment]
		else return undefined
	}
	return current
}

/** A sensible empty value when the user switches a field to `type`. */
export function defaultValue(type: FsType): FsValue {
	const now = Date.now()
	switch (type) {
		case 'null':
			return { t: 'null' }
		case 'boolean':
			return { t: 'boolean', v: false }
		case 'number':
			return { t: 'number', v: 0 }
		case 'string':
			return { t: 'string', v: '' }
		case 'timestamp':
			return { t: 'timestamp', s: Math.floor(now / 1000), n: (now % 1000) * 1e6 }
		case 'geopoint':
			return { t: 'geopoint', lat: 0, lng: 0 }
		case 'reference':
			return { t: 'reference', v: '' }
		case 'bytes':
			return { t: 'bytes', v: '' }
		case 'vector':
			return { t: 'vector', v: [] }
		case 'array':
			return { t: 'array', v: [] }
		case 'map':
			return { t: 'map', v: {} }
	}
}
