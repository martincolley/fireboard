import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Connection } from '#shared/types/connection'
import { assertEmulatorTarget } from '../loadSnapshot'

const base = { id: 'c', name: 'C', projectId: 'p' }

describe('assertEmulatorTarget', () => {
	it('refuses real projects whatever the credential type', () => {
		const real: Connection[] = [
			{ ...base, credential: { type: 'adc' } },
			{ ...base, credential: { type: 'serviceAccount', path: '/k.json' } }
		]
		for (const connection of real) {
			expect(() => assertEmulatorTarget(connection)).toThrow(/only be loaded into emulator/)
		}
	})

	it('accepts emulator connections', () => {
		expect(() =>
			assertEmulatorTarget({ ...base, credential: { type: 'emulator', host: '127.0.0.1:8080' } })
		).not.toThrow()
	})
})

describe('loadSnapshot', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('refuses a real project before wiping or writing anything', async () => {
		vi.resetModules()
		vi.doMock('../store', () => ({
			readMeta: vi.fn().mockResolvedValue({}),
			assertSnapshotData: vi.fn().mockResolvedValue(undefined),
			readSnapshotDocs: vi.fn()
		}))
		const fetchSpy = vi.fn()
		const bulkWriter = vi.fn()
		vi.stubGlobal('$fetch', fetchSpy)
		vi.doMock('../../fsTarget', () => ({
			resolveWritableTarget: vi.fn().mockResolvedValue({
				connection: { ...base, credential: { type: 'adc' } },
				db: { bulkWriter }
			})
		}))
		const { loadSnapshot } = await import('../loadSnapshot')
		await expect(
			loadSnapshot({ name: 's', conn: 'c', db: '(default)', wipe: true })
		).rejects.toThrow(/only be loaded into emulator/)
		expect(fetchSpy).not.toHaveBeenCalled()
		expect(bulkWriter).not.toHaveBeenCalled()
	})
})
