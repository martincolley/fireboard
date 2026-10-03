import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '#shared/anonymize/config'
import { loadAnonymizeConfig } from '../config'
import { LEGACY_DEFAULT_RULES } from '#shared/anonymize/legacyDefaults'

async function withConfigDir(contents?: unknown) {
	const dir = await mkdtemp(join(tmpdir(), 'fireboard-anon-'))
	vi.stubEnv('FIREBOARD_CONFIG', join(dir, 'connections.json'))
	if (contents !== undefined) await writeFile(join(dir, 'anonymize.json'), JSON.stringify(contents))
	return dir
}

describe('loadAnonymizeConfig', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it('always applies the current built-in rules, even when an older full-copy file exists', async () => {
		// The exact-key address rule an earlier version wrote into the file.
		const oldAddressRule = LEGACY_DEFAULT_RULES.find(([key]) => key.startsWith('address|street'))!
		const legacy = {
			...DEFAULT_CONFIG,
			rules: [{ key: oldAddressRule[0], strategy: oldAddressRule[1] }]
		}
		const dir = await withConfigDir(legacy)
		const { config } = await loadAnonymizeConfig()
		expect(config.rules).toEqual(DEFAULT_CONFIG.rules)
		expect(JSON.parse(await readFile(join(dir, 'anonymize.legacy.json'), 'utf8'))).toEqual(legacy)
		expect(JSON.parse(await readFile(join(dir, 'anonymize.json'), 'utf8'))).toEqual({
			extraRules: [],
			scrubEmailsInText: true,
			preserveEmailDomain: false
		})
	})

	it('puts user extra rules before the built-in rules', async () => {
		await withConfigDir({ extraRules: [{ key: 'nickname', strategy: 'firstName' }] })
		const { config } = await loadAnonymizeConfig()
		expect(config.rules[0]).toEqual({ key: 'nickname', strategy: 'firstName' })
		expect(config.rules.slice(1)).toEqual(DEFAULT_CONFIG.rules)
	})

	it('creates an overrides-only file on first use', async () => {
		const dir = await withConfigDir()
		const { config } = await loadAnonymizeConfig()
		expect(config.rules).toEqual(DEFAULT_CONFIG.rules)
		expect(JSON.parse(await readFile(join(dir, 'anonymize.json'), 'utf8'))).toEqual({
			extraRules: []
		})
	})

	it('keeps custom rules and settings from an old full-copy file, dropping stale defaults', async () => {
		const custom = { key: 'nickname', strategy: 'firstName' }
		const staleDefault = { key: '.*_?by(_?name)?', strategy: 'person' }
		const dir = await withConfigDir({
			rules: [staleDefault, custom, ...DEFAULT_CONFIG.rules],
			scrubEmailsInText: true,
			preserveEmailDomain: true
		})
		const { config } = await loadAnonymizeConfig()
		expect(config.rules).toEqual([custom, ...DEFAULT_CONFIG.rules])
		expect(config.preserveEmailDomain).toBe(true)
		expect(JSON.parse(await readFile(join(dir, 'anonymize.json'), 'utf8')).extraRules).toEqual([
			custom
		])
	})

	it('rejects unknown keys so a typo does not silently drop rules', async () => {
		await withConfigDir({ extraRule: [{ key: 'x', strategy: 'redact' }] })
		await expect(loadAnonymizeConfig()).rejects.toThrow()
	})
})
