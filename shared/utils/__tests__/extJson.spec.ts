import { describe, expect, it } from 'vitest'
import type { FsFields } from '../../types/firestore'
import { fieldsFromExtJson, fieldsToExtJson } from '../extJson'
import { isoToTimestamp, timestampToIso } from '../timestamp'

describe('extended JSON', () => {
	it('round-trips every Firestore type without losing precision', () => {
		const fields: FsFields = {
			n: { t: 'null' },
			b: { t: 'boolean', v: true },
			num: { t: 'number', v: 1.5 },
			s: { t: 'string', v: 'hi' },
			ts: { t: 'timestamp', s: 1790000000, n: 123456789 },
			geo: { t: 'geopoint', lat: -33.8, lng: 151.2 },
			ref: { t: 'reference', v: 'tenant/abc/users/x' },
			bytes: { t: 'bytes', v: 'AQID' },
			vec: { t: 'vector', v: [0.1, 0.2] },
			arr: {
				t: 'array',
				v: [
					{ t: 'number', v: 1 },
					{ t: 'map', v: { k: { t: 'string', v: 'v' } } }
				]
			},
			map: { t: 'map', v: { nested: { t: 'timestamp', s: 0, n: 0 } } }
		}
		expect(fieldsFromExtJson(JSON.parse(JSON.stringify(fieldsToExtJson(fields))))).toEqual(fields)
	})

	it('treats objects with extra keys next to a tag as plain maps', () => {
		expect(fieldsFromExtJson({ x: { __ref__: 'a/b', other: 1 } }).x!.t).toBe('map')
	})
})

describe('timestamps', () => {
	it('keeps nanoseconds and accepts offsets or missing fractions', () => {
		expect(timestampToIso(1790000000, 5)).toBe('2026-09-21T14:13:20.000000005Z')
		expect(isoToTimestamp('2026-09-21T14:13:20.000000005Z')).toEqual({ s: 1790000000, n: 5 })
		expect(isoToTimestamp('2026-09-21T16:13:20+02:00')).toEqual({ s: 1790000000, n: 0 })
		expect(() => isoToTimestamp('nope')).toThrow()
	})
})
