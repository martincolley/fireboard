import { randomBytes } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
	STARTER_FILE,
	effectiveConfig,
	migrateLegacy,
	overridesSchema,
	type AnonymizeConfig
} from '#shared/anonymize/config'
import { configPath } from '../connectionStore'

function configDir(): string {
	return dirname(configPath())
}

/**
 * Loads anonymize.json (next to the connections config). An older file that
 * stored a full copy of the defaults (`rules`) would freeze old rules, so it
 * is moved aside to anonymize.legacy.json and replaced by an overrides file.
 */
export async function loadAnonymizeConfig(): Promise<{ config: AnonymizeConfig; path: string }> {
	const path = join(configDir(), 'anonymize.json')
	let raw: unknown
	try {
		raw = JSON.parse(await readFile(path, 'utf8'))
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
		await writeFile(path, `${JSON.stringify(STARTER_FILE, null, '\t')}\n`, { mode: 0o600 })
		return { config: effectiveConfig(STARTER_FILE), path }
	}
	if (raw && typeof raw === 'object' && 'rules' in raw) {
		const migrated = migrateLegacy(raw as Partial<AnonymizeConfig>)
		await rename(path, join(configDir(), 'anonymize.legacy.json'))
		await writeFile(path, `${JSON.stringify(migrated, null, '\t')}\n`, { mode: 0o600 })
		console.warn(
			`[fireboard] anonymize.json was in the old full-copy format: kept ${migrated.extraRules.length} custom rule(s), old file saved as anonymize.legacy.json`
		)
		return { config: effectiveConfig(migrated), path }
	}
	return { config: effectiveConfig(overridesSchema.parse(raw)), path }
}

/**
 * Per-install secret so fakes are stable (the same real email always maps to
 * the same fake, keeping cross-document links intact) but not reversible.
 */
export async function loadSalt(): Promise<string> {
	const path = join(configDir(), 'anonymize-salt')
	try {
		return (await readFile(path, 'utf8')).trim()
	} catch (error) {
		// Only create a new salt when none exists: a new salt changes every fake.
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
		const salt = randomBytes(32).toString('hex')
		await writeFile(path, salt, { mode: 0o600 })
		return salt
	}
}
