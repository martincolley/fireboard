import { describe, expect, it } from 'vitest'
import type { FsValue } from '../../types/firestore'
import { fromRestValue, pathFromName, quoteSegment, toRestValue } from '../codec'
import { buildStructuredQuery } from '../query'

describe('REST codec', () => {
	it('keeps collections named "documents" in paths', () => {
		expect(pathFromName('projects/p/databases/(default)/documents/users/u1/documents/d1')).toBe(
			'users/u1/documents/d1'
		)
	})

	it('round-trips values, including vectors and nanosecond timestamps', () => {
		const values: FsValue[] = [
			{ t: 'number', v: 3 },
			{ t: 'number', v: 1.25 },
			{ t: 'timestamp', s: 1790000000, n: 5 },
			{ t: 'reference', v: 'users/a' },
			{ t: 'vector', v: [0.5, 1.5] },
			{ t: 'map', v: { a: { t: 'array', v: [{ t: 'null' }] } } }
		]
		for (const value of values) {
			expect(fromRestValue(toRestValue(value, 'p', '(default)'))).toEqual(value)
		}
	})

	it('quotes field path segments that are not plain identifiers', () => {
		expect(quoteSegment('name')).toBe('name')
		expect(quoteSegment('odd key.x')).toBe('`odd key.x`')
		expect(quoteSegment('a`b')).toBe('`a\\`b`')
	})
})

describe('buildStructuredQuery', () => {
	it('adds the implied order for inequalities and __name__ last, like the SDKs', () => {
		const built = buildStructuredQuery(
			{
				conn: 'c',
				db: '(default)',
				path: 'tenants/t1/users',
				filters: [{ field: 'age', op: '>', value: { t: 'number', v: 3 } }],
				limit: 10
			},
			'p'
		)
		expect(built.parent).toBe('projects/p/databases/(default)/documents/tenants/t1')
		expect(built.orderBy).toEqual([
			{ field: 'age', dir: 'asc' },
			{ field: '__name__', dir: 'asc' }
		])
		expect(built.structuredQuery.from).toEqual([{ collectionId: 'users', allDescendants: false }])
	})

	it('uses unary filters for null and full references for document ids', () => {
		const built = buildStructuredQuery(
			{
				conn: 'c',
				db: 'default-au',
				path: 'users',
				filters: [
					{ field: 'deletedAt', op: '==', value: { t: 'null' } },
					{ field: '__name__', op: 'in', value: { t: 'array', v: [{ t: 'string', v: 'a' }] } }
				]
			},
			'p'
		)
		expect(built.structuredQuery.where).toEqual({
			compositeFilter: {
				op: 'AND',
				filters: [
					{ unaryFilter: { op: 'IS_NULL', field: { fieldPath: 'deletedAt' } } },
					{
						fieldFilter: {
							field: { fieldPath: '__name__' },
							op: 'IN',
							value: {
								arrayValue: {
									values: [{ referenceValue: 'projects/p/databases/default-au/documents/users/a' }]
								}
							}
						}
					}
				]
			}
		})
	})

	it('builds a cursor from the last document using the effective order', () => {
		const built = buildStructuredQuery(
			{
				conn: 'c',
				db: '(default)',
				path: 'users',
				orderBy: [{ field: 'profile.age', dir: 'desc' }]
			},
			'p',
			{
				id: 'u1',
				path: 'users/u1',
				fields: { profile: { t: 'map', v: { age: { t: 'number', v: 40 } } } }
			}
		)
		expect(built.structuredQuery.startAt).toEqual({
			before: false,
			values: [
				{ integerValue: '40' },
				{ referenceValue: 'projects/p/databases/(default)/documents/users/u1' }
			]
		})
	})

	it('orders implied inequality fields after explicit orders, sorted, then __name__ (SDK semantics)', () => {
		const built = buildStructuredQuery(
			{
				conn: 'c',
				db: '(default)',
				path: 'users',
				orderBy: [{ field: 'name', dir: 'desc' }],
				filters: [
					{ field: 'zeta', op: '>', value: { t: 'number', v: 1 } },
					{ field: 'age', op: '!=', value: { t: 'number', v: 2 } }
				]
			},
			'p'
		)
		expect(built.orderBy).toEqual([
			{ field: 'name', dir: 'desc' },
			{ field: 'age', dir: 'desc' },
			{ field: 'zeta', dir: 'desc' },
			{ field: '__name__', dir: 'desc' }
		])
	})
})
