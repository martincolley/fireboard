import { z } from 'zod'
import { LEGACY_DEFAULT_RULES } from './legacyDefaults'

export const strategies = [
	'email',
	'firstName',
	'lastName',
	'fullName',
	/** A person's name, unless the value looks like an id (e.g. "...By" fields holding uids). */
	'person',
	/** A business / client entity name. */
	'company',
	'phone',
	'address',
	/** Postcode / zip: same number of digits. */
	'postcode',
	/** Suburb / city / town. */
	'locality',
	'ip',
	'date',
	'lorem',
	'redact',
	'keep'
] as const

export type Strategy = (typeof strategies)[number]

const configSchema = z.object({
	rules: z.array(
		z.object({
			/** Regex (case-insensitive) matched against the whole field key. */
			key: z.string(),
			strategy: z.enum(strategies),
			/** Only apply inside these collection ids (any depth). Omit for everywhere. */
			collections: z.array(z.string()).optional()
		})
	),
	/** Replace email addresses found anywhere inside other strings. */
	scrubEmailsInText: z.boolean(),
	/** Keep the real domain of fake emails (useful when app logic matches on domain). */
	preserveEmailDomain: z.boolean()
})

export type AnonymizeConfig = z.infer<typeof configSchema>

/** Matched against the document's own (parent) collection id. */
const COMPANIES = [
	'companies',
	'clients',
	'organisations',
	'organizations',
	'entities',
	'businesses'
]
const PEOPLE = ['users', 'profiles', 'contacts', 'members', 'people', 'staff', 'employees', 'team']

/** First matching rule wins, so specific rules come first. Keys match whole, case-insensitive. */
export const DEFAULT_CONFIG: AnonymizeConfig = {
	rules: [
		{
			key: '.*(password|passcode|secret|token|api_?key|private_?key|salt|otp|recovery_?codes?)s?|pin|.*_hash|.*password_?hash',
			strategy: 'redact'
		},
		{
			key: '((employer|employee|client|customer|business|company|entity|personal|payee|payer|supplier|vendor|staff|director|trustee|beneficiary|partner|member|user|owner)_?|.*_)?(tfn|abn|acn|ein|vat_?number|gst_?number|ssn|sin|nino|tax_?(id|number|file_?number)|bsb|iban|swift|bic|(bank_?)?account_?number|bank_?account|routing_?number|card_?number|credit_?card|cvv|passport(_?number)?|drivers?_?licen[cs]e|licen[cs]e_?number|medicare(_?number)?)',
			strategy: 'redact'
		},
		{ key: '.*e-?mail(_?address)?(es|s)?', strategy: 'email' },
		{ key: '(first|given|preferred|middle)_?name', strategy: 'firstName' },
		{ key: '(last|family|sur)_?name|surname', strategy: 'lastName' },
		{
			key: '.*(company|business|trading|legal|entity|client|organi[sz]ation|org|firm)_?name(_?lower)?',
			strategy: 'company'
		},
		{ key: '(full|display|contact)_?name(_?lower)?', strategy: 'fullName' },
		{ key: 'name(_?lower)?', strategy: 'fullName', collections: PEOPLE },
		{ key: 'name(_?lower)?', strategy: 'company', collections: COMPANIES },
		{
			key: '.*(user|owner|author|creator|assignee|actor|member|contact|sender|recipient|person)_?name(_?lower)?',
			strategy: 'fullName'
		},
		{
			key: '(created|updated|modified|deleted|approved|lodged|assigned|submitted|reviewed|owned|completed|performed|invited|requested|sent|signed|uploaded|archived|closed|resolved|added|removed|changed|edited|verified|prepared|filed)_?by(_?name)?|.*(lodged|performed|prepared|filed)_?by',
			strategy: 'person'
		},
		{
			key: '.*(phone|mobile|telephone|fax|contact_?number|whats_?app)(_?number)?s?|tel|(.*_)?cell(_?(phone|number))?',
			strategy: 'phone'
		},
		{
			key: '(.*_)?ip(_?address)?|.*(device|client|user|remote|last|server|public|private|local)_?ip(_?address)?',
			strategy: 'ip'
		},
		{
			key: '.*(web|website|url|wallet|mac|server|host|contract|bitcoin|eth|ens|smart_?contract)_?address(es)?',
			strategy: 'keep'
		},
		{ key: '.*(post_?code|postal_?code|zip(_?code)?)', strategy: 'postcode' },
		{
			key: '(.*_)?(suburb|city|town|locality)|.*(home|postal|billing|mailing|residential|business|work|shipping|delivery|street)_?(suburb|city|town|locality)',
			strategy: 'locality'
		},
		{
			key: '.*address(_?line_?\\d?)?(es)?|.*street(_?address|_?name|_?number)?|address_?line_?\\d?',
			strategy: 'address'
		},
		{ key: 'state|country(_?code)?|region|province', strategy: 'keep' },

		{ key: 'dob|date_?of_?birth|birth_?date|birthday', strategy: 'date' },
		{
			key: 'body|content|html|text|message|notes?|comment|transcript|body_?(html|text)|snippet',
			strategy: 'lorem'
		}
	],
	scrubEmailsInText: true,
	preserveEmailDomain: false
}

const ruleSchema = z.object({
	key: z.string(),
	strategy: z.enum(strategies),
	collections: z.array(z.string()).optional()
})

/**
 * What anonymize.json holds: only the user's additions. Built-in defaults are
 * never copied into the file, so rule fixes in new versions always apply.
 */
export const overridesSchema = z.strictObject({
	/** Checked before the built-in rules, so they can add or override behaviour. */
	extraRules: z.array(ruleSchema).default([]),
	scrubEmailsInText: z.boolean().optional(),
	preserveEmailDomain: z.boolean().optional()
})

export type AnonymizeOverrides = z.infer<typeof overridesSchema>

export const STARTER_FILE: AnonymizeOverrides = { extraRules: [] }

/** Built-in rules plus the user's extra rules (which win). */
export function effectiveConfig(overrides: AnonymizeOverrides): AnonymizeConfig {
	return {
		rules: [...overrides.extraRules, ...DEFAULT_CONFIG.rules],
		scrubEmailsInText: overrides.scrubEmailsInText ?? DEFAULT_CONFIG.scrubEmailsInText,
		preserveEmailDomain: overrides.preserveEmailDomain ?? DEFAULT_CONFIG.preserveEmailDomain
	}
}

const stripSlashes = (key: string) => key.replace(/\\/g, '')

/** Keeps a legacy file's custom rules and settings; drops copies of built-in defaults (old or current). */
export function migrateLegacy(legacy: Partial<AnonymizeConfig>): AnonymizeOverrides {
	const known = new Set(
		[...LEGACY_DEFAULT_RULES, ...DEFAULT_CONFIG.rules.map((r) => [r.key, r.strategy] as const)].map(
			([key, strategy]) => `${stripSlashes(key)} ${strategy}`
		)
	)
	const rules = z.array(ruleSchema).catch([]).parse(legacy.rules)
	return {
		extraRules: rules.filter((r) => !known.has(`${stripSlashes(r.key)} ${r.strategy}`)),
		...(typeof legacy.scrubEmailsInText === 'boolean'
			? { scrubEmailsInText: legacy.scrubEmailsInText }
			: {}),
		...(typeof legacy.preserveEmailDomain === 'boolean'
			? { preserveEmailDomain: legacy.preserveEmailDomain }
			: {})
	}
}
