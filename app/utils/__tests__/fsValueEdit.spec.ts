import { describe, expect, it } from 'vitest'
import type { FsFields } from '#shared/types/firestore'
import { toFieldUpdate } from '../fsValueEdit'

const fields: FsFields = {
	profile: { t: 'map', v: { name: { t: 'string', v: 'Pam' } } },
	tags: {
		t: 'array',
		v: [
			{ t: 'string', v: 'a' },
			{ t: 'map', v: { label: { t: 'string', v: 'b' } } }
		]
	}
}

describe('toFieldUpdate', () => {
	it('updates nested map keys in place', () => {
		expect(toFieldUpdate(fields, ['profile', 'name'], { t: 'string', v: 'Delphine' })).toEqual({
			field: ['profile', 'name'],
			value: { t: 'string', v: 'Delphine' }
		})
	})

	it('rewrites the whole array when an element changes, since Firestore cannot address indexes', () => {
		const update = toFieldUpdate(fields, ['tags', 1, 'label'], { t: 'string', v: 'c' })
		expect(update.field).toEqual(['tags'])
		expect(update.value).toEqual({
			t: 'array',
			v: [
				{ t: 'string', v: 'a' },
				{ t: 'map', v: { label: { t: 'string', v: 'c' } } }
			]
		})
	})

	it('removes array elements and deletes plain fields', () => {
		expect(toFieldUpdate(fields, ['tags', 0], undefined).value).toEqual({
			t: 'array',
			v: [{ t: 'map', v: { label: { t: 'string', v: 'b' } } }]
		})
		expect(toFieldUpdate(fields, ['profile'], undefined)).toEqual({
			field: ['profile'],
			value: undefined
		})
	})
})
