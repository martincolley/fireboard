import type { FsFields, FsValue } from '../types/firestore'

/** Reads a dotted field path ("a.b.c") from document fields. */
export function getFieldValue(fields: FsFields, path: string): FsValue | undefined {
	let current: FsValue | undefined = { t: 'map', v: fields }
	for (const segment of path.split('.')) {
		if (current?.t !== 'map') return undefined
		current = current.v[segment]
	}
	return current
}
