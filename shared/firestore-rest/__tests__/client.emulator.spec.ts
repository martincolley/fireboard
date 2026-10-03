import { beforeAll, describe, expect, it } from 'vitest'
import { FirestoreRestClient } from '../client'

/**
 * Runs the browser REST client against a real Firestore emulator.
 * Skipped unless FIREBOARD_TEST_EMULATOR is set, e.g. FIREBOARD_TEST_EMULATOR=127.0.0.1:8399.
 */
const host = process.env.FIREBOARD_TEST_EMULATOR
const db = '(default)'

describe.skipIf(!host)('FirestoreRestClient against the emulator', () => {
	const client = new FirestoreRestClient({
		projectId: `demo-rest-${Date.now()}`,
		emulatorHost: host,
		getToken: async () => 'owner'
	})

	beforeAll(async () => {
		await client.wipeEmulator(db)
		await client.writeDocuments(db, [
			{
				path: 'users/u1',
				fields: {
					name: { t: 'string', v: 'Ann' },
					age: { t: 'number', v: 30 },
					score: { t: 'number', v: 1.5 },
					joined: { t: 'timestamp', s: 1790000000, n: 123456000 },
					tags: { t: 'array', v: [{ t: 'string', v: 'a' }] },
					manager: { t: 'reference', v: 'users/u2' },
					geo: { t: 'geopoint', lat: 1.5, lng: 2.5 },
					nothing: { t: 'null' },
					profile: { t: 'map', v: { city: { t: 'string', v: 'Perth' } } }
				}
			},
			{
				path: 'users/u2',
				fields: { name: { t: 'string', v: 'Bob' }, age: { t: 'number', v: 40 } }
			},
			{ path: 'users/u3', fields: { name: { t: 'string', v: 'Cy' }, age: { t: 'number', v: 50 } } },
			{
				path: 'tenants/t1/users/u9',
				fields: { name: { t: 'string', v: 'Deb' }, age: { t: 'number', v: 60 } }
			}
		])
	})

	it('round-trips every value type', async () => {
		const { doc } = await client.getDocument(db, 'users/u1')
		expect(doc?.fields).toMatchObject({
			age: { t: 'number', v: 30 },
			score: { t: 'number', v: 1.5 },
			joined: { t: 'timestamp', s: 1790000000, n: 123456000 },
			manager: { t: 'reference', v: 'users/u2' },
			geo: { t: 'geopoint', lat: 1.5, lng: 2.5 },
			nothing: { t: 'null' },
			profile: { t: 'map', v: { city: { t: 'string', v: 'Perth' } } }
		})
	})

	it('lists collections and shows missing parents', async () => {
		expect(await client.listCollectionIds(db)).toEqual(['tenants', 'users'])
		const page = await client.listDocuments(db, 'tenants', 10)
		expect(page.docs).toEqual([expect.objectContaining({ path: 'tenants/t1', missing: true })])
	})

	it('filters, orders, pages with cursors and counts', async () => {
		const q = {
			conn: 'x',
			db,
			path: 'users',
			filters: [{ field: 'age', op: '>=' as const, value: { t: 'number' as const, v: 30 } }],
			orderBy: [{ field: 'age', dir: 'desc' as const }],
			limit: 2
		}
		const first = await client.runQuery(q)
		expect(first.docs.map((d) => d.id)).toEqual(['u3', 'u2'])
		expect(first.hasMore).toBe(true)
		const second = await client.runQuery(q, first.docs.at(-1))
		expect(second.docs.map((d) => d.id)).toEqual(['u1'])
		expect(await client.count({ ...q, limit: undefined })).toBe(3)
	})

	it('runs collection group and document id queries', async () => {
		const group = await client.runQuery({
			conn: 'x',
			db,
			path: 'users',
			group: true,
			filters: [{ field: 'age', op: '==', value: { t: 'number', v: 60 } }]
		})
		expect(group.docs.map((d) => d.path)).toEqual(['tenants/t1/users/u9'])
		const byId = await client.runQuery({
			conn: 'x',
			db,
			path: 'users',
			filters: [{ field: '__name__', op: '==', value: { t: 'string', v: 'u2' } }]
		})
		expect(byId.docs.map((d) => d.id)).toEqual(['u2'])
		const nulls = await client.runQuery({
			conn: 'x',
			db,
			path: 'users',
			filters: [{ field: 'nothing', op: '==', value: { t: 'null' } }]
		})
		expect(nulls.docs.map((d) => d.id)).toEqual(['u1'])
	})

	it('updates and deletes single fields, including dotted and odd keys', async () => {
		await client.updateField(db, 'users/u2', ['profile', 'city'], { t: 'string', v: 'Hobart' })
		let doc = await client.updateField(db, 'users/u2', ['odd key.x'], { t: 'boolean', v: true })
		expect(doc.fields.profile).toEqual({ t: 'map', v: { city: { t: 'string', v: 'Hobart' } } })
		expect(doc.fields['odd key.x']).toEqual({ t: 'boolean', v: true })
		doc = await client.updateField(db, 'users/u2', ['odd key.x'], undefined)
		expect(doc.fields['odd key.x']).toBeUndefined()
		await expect(client.updateField(db, 'users/nope', ['a'], { t: 'null' })).rejects.toThrow()
	})

	it('creates, replaces and recursively deletes documents', async () => {
		const created = await client.createDocument(db, 'tenants/t1/notes', 'n1', {
			a: { t: 'number', v: 1 }
		})
		expect(created.path).toBe('tenants/t1/notes/n1')
		await expect(client.createDocument(db, 'tenants/t1/notes', 'n1', {})).rejects.toThrow()
		const auto = await client.createDocument(db, 'users', undefined, {
			name: { t: 'string', v: 'Auto' }
		})
		expect(auto.id).toHaveLength(20)
		const replaced = await client.setDocument(db, 'tenants/t1/notes/n1', {
			b: { t: 'number', v: 2 }
		})
		expect(Object.keys(replaced.fields)).toEqual(['b'])
		await client.deleteDocument(db, 'tenants/t1', true)
		expect(await client.listCollectionIds(db, 'tenants/t1')).toEqual([])
	})

	it('handles a subcollection named "documents" (paths, get, recursive delete)', async () => {
		await client.writeDocuments(db, [
			{ path: 'folders/f1/documents/d1', fields: { a: { t: 'number', v: 1 } } }
		])
		const page = await client.listDocuments(db, 'folders/f1/documents', 10)
		expect(page.docs.map((d) => [d.path, d.id])).toEqual([['folders/f1/documents/d1', 'd1']])
		expect((await client.getDocument(db, 'folders/f1/documents/d1')).doc?.path).toBe(
			'folders/f1/documents/d1'
		)
		await client.deleteDocument(db, 'folders/f1', true)
		expect((await client.listDocuments(db, 'folders/f1/documents', 10)).docs).toEqual([])
	})

	it('orders like the SDK when an inequality and an explicit order are combined', async () => {
		await client.writeDocuments(db, [
			{ path: 'people/a', fields: { name: { t: 'string', v: 'a' }, age: { t: 'number', v: 4 } } },
			{ path: 'people/b', fields: { name: { t: 'string', v: 'b' }, age: { t: 'number', v: 3 } } },
			{ path: 'people/c', fields: { name: { t: 'string', v: 'c' }, age: { t: 'number', v: 2 } } }
		])
		const res = await client.runQuery({
			conn: 'x',
			db,
			path: 'people',
			filters: [{ field: 'age', op: '>', value: { t: 'number', v: 1 } }],
			orderBy: [{ field: 'name', dir: 'desc' }]
		})
		expect(res.docs.map((d) => d.id)).toEqual(['c', 'b', 'a'])
	})
})
