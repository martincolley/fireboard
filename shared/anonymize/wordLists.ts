/**
 * Words that appear in company names but identify nobody. They are never
 * learned, so "The Price Family Trust" doesn't turn every "the" into a fake.
 */
export const COMPANY_STOPWORDS = new Set([
	'the',
	'and',
	'of',
	'for',
	'pty',
	'ltd',
	'limited',
	'llc',
	'inc',
	'co',
	'company',
	'corp',
	'corporation',
	'group',
	'holdings',
	'trust',
	'family',
	'partners',
	'partnership',
	'services',
	'service',
	'solutions',
	'consulting',
	'consultants',
	'accounting',
	'accountants',
	'bookkeeping',
	'advisory',
	'advisors',
	'business',
	'enterprises',
	'international',
	'australia',
	'global',
	'management',
	'investments',
	'properties',
	'property',
	'trading',
	'group',
	'superannuation',
	'super',
	'fund',
	'unit',
	'discretionary',
	'estate',
	'the',
	'construction',
	'electrical',
	'plumbing',
	'cleaning',
	'design',
	'studio',
	'media',
	'digital',
	'tax',
	'legal',
	'health'
])

/**
 * Real first or last names that are also ordinary words. They are still
 * learned, but in text only replaced when capitalized ("Grant" yes, "grant" no).
 */
export const COMMON_WORDS = new Set([
	'will',
	'may',
	'june',
	'april',
	'august',
	'grant',
	'page',
	'price',
	'mark',
	'bill',
	'rose',
	'hope',
	'joy',
	'grace',
	'summer',
	'dawn',
	'sky',
	'river',
	'stone',
	'hill',
	'wood',
	'young',
	'king',
	'green',
	'white',
	'black',
	'brown',
	'gray',
	'grey',
	'long',
	'short',
	'little',
	'chase',
	'case',
	'pay',
	'cash',
	'bank',
	'park',
	'lane',
	'bay',
	'ray',
	'rich',
	'banks',
	'frank',
	'jack',
	'art',
	'drew',
	'van',
	'max',
	'ash'
])

const ENUM_WORDS =
	'status|type|role|kind|state|colou?r|category|mode|stage|priority|level|variant|tier|plan|frequency|period|unit|currency|locale|language|timezone|region|source|channel|method|format'
const ENUM_WHOLE = new RegExp(`^(${ENUM_WORDS})(es|s)?$`, 'i')
const ENUM_SNAKE = new RegExp(`_(${ENUM_WORDS})(es|s)?$`, 'i')
/** camelCase suffix: "taskStatus", "accountRole" (not "estate", which only ends in "state"). */
const ENUM_CAMEL = new RegExp(
	`[a-z0-9](${ENUM_WORDS.split('|')
		.map((w) => w[0]!.toUpperCase() + w.slice(1))
		.join('|')})(es|s)?$`
)

/** Keys whose values are usually machine values (enums). */
export function isEnumKey(key: string): boolean {
	return ENUM_WHOLE.test(key) || ENUM_SNAKE.test(key) || ENUM_CAMEL.test(key)
}

/** An enum-looking value: one short token without spaces. Anything longer is treated as prose. */
export const ENUM_VALUE = /^[A-Za-z0-9_.:-]{1,32}$/

/**
 * Values under name-like keys that are roles or system actors, not people
 * ("createdBy: system", "displayName: Support Team"). Never learned as names.
 */
export const GENERIC_ACTORS = new Set([
	'system',
	'admin',
	'administrator',
	'support',
	'team',
	'api',
	'bot',
	'import',
	'importer',
	'unknown',
	'service',
	'user',
	'users',
	'owner',
	'automation',
	'automated',
	'migration',
	'script',
	'cron',
	'scheduler',
	'webhook',
	'integration',
	'guest',
	'anonymous',
	'client',
	'staff',
	'member',
	'manager',
	'test',
	'demo',
	'default',
	'none',
	'null',
	'undefined',
	'app',
	'server',
	'worker',
	'sync',
	'backend',
	'portal',
	'everyone',
	'all',
	'nobody',
	'deleted',
	'removed',
	'former'
])
