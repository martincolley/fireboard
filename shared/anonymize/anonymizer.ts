import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import type { FsFields, FsValue } from '#shared/types/firestore'
import type { AnonymizeConfig, Strategy } from './config'
import {
	COMPANY_SUFFIXES,
	COMPANY_WORDS,
	FIRST_NAMES,
	LAST_NAMES,
	LOCALITIES,
	STREETS,
	lorem
} from './fakeData'
import { COMMON_WORDS, COMPANY_STOPWORDS, ENUM_VALUE, GENERIC_ACTORS, isEnumKey } from './wordLists'

/** Bounded parts and no match starting mid-run, so long tokens/base64 scan in linear time. */
const encoder = new TextEncoder()
const EMAIL = /(?<![A-Z0-9._%+-])[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,24}(?![A-Z0-9-])/gi
/**
 * Phone-like runs in text: starts with +, 0 or "(", 8 to 15 digits, only space/dot/dash/paren
 * separators, and not part of a larger token (UUIDs, dates, paths, times).
 */
const PHONE_IN_TEXT = /(?<![\w+\-/.:])(?:\+|0|\()[\d\s().-]{6,}\d(?![\w\-/:])/g
/**
 * Tax and bank numbers in text: a labelled number ("ABN 51 824 753 556",
 * "TFN: 123456782", "BSB 062-000 acct 12345678"), or the 2-3-3-3 / 3-3-3 grouped
 * format ABNs, ACNs and TFNs are usually written in.
 */
const LABELLED_NUMBER =
	/\b(ABN|ACN|TFN|ARBN|BSB|IBAN|SSN|EIN|NINO|tax file (?:no|number)|acc(?:oun)?t(?:\s*(?:no|number|#))?|account number)((?:(?:\s{0,8}[:#=.]\s{0,8}|\s{1,8})(?:is|no\.?|number|of)\b)*(?:\s*[:#=.]\s*|\s*))([A-Z]{0,2}\d[\d\s-]{4,}\d)/gi
/** Grouped numbers; trailing punctuation is fine unless another digit follows (1,234 / 1.5). */
const GROUPED_ID = /(?<![\w.,+-])\d{2,3}(?: \d{3}){2,3}(?![\w-]|[.,]\d)/g
/** A date or time that a labelled number must not swallow. */
const TRAILING_DATE = /\s+(?=\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/
const EMAIL_EXACT = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
const FIXED_BIRTH_DATE = { t: 'timestamp', s: 631152000, n: 0 } as const // 1990-01-01
/** Firestore ids / uids: no spaces, and either contain a digit or are 20+ plain alphanumerics. */
const LOOKS_LIKE_ID = /^(?=\S*\d)[A-Za-z0-9_-]{16,}$|^[A-Za-z0-9]{20,}$/
/** Shorter learned tokens are ignored so "Al" doesn't rewrite every word containing it. */
const MIN_TOKEN = 3
const LEARNED: ReadonlySet<Strategy> = new Set([
	'firstName',
	'lastName',
	'fullName',
	'person',
	'company'
])
const NAME_POOL = [...FIRST_NAMES, ...LAST_NAMES]
/** Separators a name can be joined with in slugs and ids ("marisol-okafor", "marisol_okafor"). */
const SLUG_SEPARATORS = /[\s._-]+/

interface CompiledRule {
	key: RegExp
	strategy: Strategy
	collections?: Set<string>
}

/**
 * Where a string sits: `enum` values are never touched, `keywords` (arrays of
 * single words, e.g. search keywords) replace every learned token, `prose`
 * spares lowercase common words such as "grant".
 */
type TextContext = 'prose' | 'enum' | 'keywords'

function isKeywordArray(values: FsValue[]): boolean {
	return values.length > 0 && values.every((v) => v.t === 'string' && !/\s/.test(v.v))
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** lat/lng inside an address map. */
const COORDINATE_KEY = /^(lat|lng|lon|long|latitude|longitude)$/i

/** Rounds coordinates to 1 decimal (about 10 km) so they can't locate a home. */
function roundCoordinate(value: FsValue): FsValue {
	const round = (n: number) => Math.round(n * 10) / 10
	if (value.t === 'number') return { t: 'number', v: round(value.v) }
	if (value.t === 'geopoint') return { t: 'geopoint', lat: round(value.lat), lng: round(value.lng) }
	return value
}

/** Keeps the casing style of the original (all lower, all upper, or as generated). */
function matchCase(original: string, fake: string): string {
	if (original === original.toLowerCase()) return fake.toLowerCase()
	if (original === original.toUpperCase()) return fake.toUpperCase()
	return fake
}

function normalizeName(text: string): string {
	return text.trim().toLowerCase().split(SLUG_SEPARATORS).join(' ')
}

/** The document's own collection id (rules scoped by collection look only at the parent). */
function parentCollection(docPath: string): string {
	const segments = docPath.split('/')
	return segments[segments.length - 2] ?? ''
}

/**
 * Deterministic pseudonymizer for Firestore documents: real values are
 * replaced with stable fakes derived from an HMAC of the original, so the
 * shape and cross-references of real data survive while the PII does not.
 *
 * Two passes: `learn()` every document first so names found under known keys
 * (firstName, companyName, ...By) are also replaced wherever they were copied,
 * then `fields()` / `path()`.
 *
 * What is replaced where:
 * - Values: emails, learned full names and learned name tokens in any case
 *   (common words like "grant" only when capitalized; nothing under enum keys).
 * - Nested map keys and document ids: only whole emails and whole learned full
 *   names, including slugs ("marisol-okafor"). Ordinary keys are schema.
 * - Top-level field names: never.
 *
 * Every mapping depends only on the original text and the salt, never on the
 * order documents were seen, so repeated exports of the same data match.
 */
export class Anonymizer {
	private readonly rules: CompiledRule[]
	/** Normalized multi-word names ("marisol okafor") -> fake. */
	private readonly phrases = new Map<string, string>()
	/** Lowercased single name tokens ("marisol") -> fake. */
	private readonly tokens = new Map<string, string>()
	/** Tokens learned from people win over company words for the same token. */
	private readonly personTokens = new Set<string>()
	/** Distinctive words of company names: replaced in text only when capitalized. */
	private readonly companyTokens = new Set<string>()
	/** Phrases learned from people: a company phrase never overwrites them. */
	private readonly personPhrases = new Set<string>()
	private pattern: RegExp | null = null
	private readonly hashes = new Map<string, number>()
	private readonly saltBytes: Uint8Array
	private dirty = false

	constructor(
		private readonly config: AnonymizeConfig,
		salt: string
	) {
		this.saltBytes = encoder.encode(salt)
		this.rules = config.rules.map((rule) => ({
			key: new RegExp(`^(?:${rule.key})$`, 'i'),
			strategy: rule.strategy,
			collections: rule.collections ? new Set(rule.collections) : undefined
		}))
	}

	/** Pass 1: records real names (no transformation) so their copies can be replaced later. */
	learn(fields: FsFields, docPath: string): void {
		const collection = parentCollection(docPath)
		const visit = (value: FsValue, strategy: Strategy | undefined) => {
			if (value.t === 'map') {
				const parts: Partial<Record<'firstName' | 'lastName', string>> = {}
				for (const [key, child] of Object.entries(value.v)) {
					const childStrategy = strategy ?? this.strategyFor(key, collection)
					if (
						(childStrategy === 'firstName' || childStrategy === 'lastName') &&
						child.t === 'string'
					) {
						parts[childStrategy] = child.v.trim()
					}
					visit(child, childStrategy)
				}
				// Separate first/last fields also make a full name, so ids like "delphine-whitcombe" are caught.
				if (parts.firstName && parts.lastName)
					this.fakePerson(`${parts.firstName} ${parts.lastName}`)
			} else if (value.t === 'array') {
				for (const item of value.v) visit(item, strategy)
			} else if (value.t === 'string' && strategy && LEARNED.has(strategy)) {
				this.learnName(value.v, strategy)
			}
		}
		visit({ t: 'map', v: fields }, undefined)
	}

	/** Anonymizes a path: document id segments (never collection ids) that are emails or learned names. */
	path(path: string): string {
		return path
			.split('/')
			.map((segment, i) => (i % 2 === 1 ? this.scrubIdentifier(segment) : segment))
			.join('/')
	}

	fields(fields: FsFields, docPath: string): FsFields {
		const collection = parentCollection(docPath)
		const out: FsFields = {}
		for (const [key, value] of Object.entries(fields)) {
			out[key] = this.transform(key, value, collection)
		}
		return out
	}

	private transform(key: string, value: FsValue, collection: string): FsValue {
		const strategy = this.strategyFor(key, collection)
		if (strategy) return this.apply(value, strategy)
		return this.walk(value, collection, isEnumKey(key) ? 'enum' : 'prose')
	}

	private strategyFor(key: string, collection: string): Strategy | undefined {
		const strategy = this.ruleFor(key, collection)
		return strategy === 'keep' ? undefined : strategy
	}

	/** The first matching rule's strategy, including 'keep'. */
	private ruleFor(key: string, collection = ''): Strategy | undefined {
		return this.rules.find(
			(r) => r.key.test(key) && (!r.collections || r.collections.has(collection))
		)?.strategy
	}

	/** Renames nested map keys that are emails or full names, never colliding with another key. */
	private mapEntries(
		map: Record<string, FsValue>,
		convert: (key: string, child: FsValue) => FsValue
	): Record<string, FsValue> {
		const out: Record<string, FsValue> = {}
		for (const [key, child] of Object.entries(map)) {
			let target = this.scrubIdentifier(key)
			while (target !== key && (target in out || target in map)) target = `${target}_`
			out[target] = convert(key, child)
		}
		return out
	}

	/** No rule matched: recurse, scrubbing strings, references and identifying map keys. */
	private walk(value: FsValue, collection: string, context: TextContext): FsValue {
		switch (value.t) {
			case 'map':
				return {
					t: 'map',
					v: this.mapEntries(value.v, (key, child) => this.transform(key, child, collection))
				}
			case 'array': {
				const itemContext = context === 'prose' && isKeywordArray(value.v) ? 'keywords' : context
				return { t: 'array', v: value.v.map((item) => this.walk(item, collection, itemContext)) }
			}
			case 'string':
				return { t: 'string', v: this.scrubText(value.v, context) }
			case 'reference':
				return { t: 'reference', v: this.path(value.v) }
			default:
				return value
		}
	}

	/** A rule matched: transform every leaf under this key with the rule's strategy. */
	private apply(value: FsValue, strategy: Strategy): FsValue {
		switch (value.t) {
			case 'map':
				return {
					t: 'map',
					v: this.mapEntries(value.v, (key, child) => {
						if (strategy !== 'address') return this.apply(child, strategy)
						// Inside an address: postcode, suburb and street parts each get their own fake; state/country stay.
						if (COORDINATE_KEY.test(key)) return roundCoordinate(child)
						const part = this.ruleFor(key)
						if (part === 'keep') return child
						// Any other part (line1, unit, building...) is treated as part of the street address.
						const partStrategy =
							part === 'postcode' || part === 'locality' || part === 'address' ? part : 'address'
						return this.apply(child, partStrategy)
					})
				}
			case 'array':
				return { t: 'array', v: value.v.map((item) => this.apply(item, strategy)) }
			case 'string':
				return { t: 'string', v: this.applyString(value.v, strategy) }
			case 'number':
				return strategy === 'phone'
					? { t: 'number', v: 5550000000 + (this.hash('phone', String(value.v)) % 1e6) }
					: value
			case 'timestamp':
				return strategy === 'date' ? FIXED_BIRTH_DATE : value
			case 'geopoint':
				return strategy === 'address' ? roundCoordinate(value) : value
			case 'reference':
				return { t: 'reference', v: this.path(value.v) }
			case 'bytes':
				return strategy === 'redact' ? { t: 'bytes', v: '' } : value
			default:
				return value
		}
	}

	private applyString(original: string, strategy: Strategy): string {
		if (original === '') return original
		if (strategy === 'redact') return '[redacted]'
		if (EMAIL_EXACT.test(original.trim())) return this.fakeEmail(original.trim())
		if (strategy === 'person' && LOOKS_LIKE_ID.test(original)) {
			return this.scrubText(original, 'prose')
		}
		const h = this.hash(strategy, original)
		switch (strategy) {
			case 'email':
				return this.scrubText(original, 'prose')
			case 'firstName':
			case 'lastName':
			case 'fullName':
			case 'person':
				return matchCase(original, this.fakePerson(original, strategy === 'person'))
			case 'company':
				return matchCase(original, this.fakeCompany(original))
			case 'phone':
				return `+1555${String(h % 1e7).padStart(7, '0')}`
			case 'address':
				return `${(h % 899) + 1} ${STREETS[h % STREETS.length]}`
			case 'postcode':
				return original.replace(/\d/g, (_, i: number) =>
					String(this.hash('postcode', `${original}:${i}`) % 10)
				)
			case 'locality':
				return LOCALITIES[h % LOCALITIES.length]!
			case 'ip':
				return `203.0.113.${h % 255}`
			case 'date':
				return '1990-01-01'
			case 'lorem': {
				const text = lorem(original.replace(/<[^>]*>/g, '').length, h % 40)
				return original.trimStart().startsWith('<') ? `<p>${text}</p>` : text
			}
			case 'keep':
				return original
		}
	}

	private learnName(original: string, strategy: Strategy): void {
		const value = original.trim()
		if (!value || EMAIL_EXACT.test(value)) return
		if (strategy === 'person' && LOOKS_LIKE_ID.test(value)) return
		if (strategy === 'company') this.fakeCompany(value)
		else this.fakePerson(value, strategy === 'person')
	}

	/** Picks from `list` by hash of the lowercased original, never returning the original itself. */
	private pick(list: readonly string[], kind: string, original: string): string {
		const h = this.hash(kind, original.toLowerCase())
		const first = list[h % list.length]!
		return first.toLowerCase() === original.toLowerCase() ? list[(h + 1) % list.length]! : first
	}

	/**
	 * A person token's fake depends only on the token, so "Marisol" maps the same
	 * in every field. Roles and system actors ("system", "admin", "Support Team")
	 * are never learned; values from "...By" fields must also be capitalized,
	 * since those often hold usernames or actor ids rather than names.
	 */
	private personToken(token: string, requireCapital: boolean): string {
		const key = token.toLowerCase()
		const fake = this.pick(NAME_POOL, 'token', token)
		if (
			key.length >= MIN_TOKEN &&
			(!requireCapital || /^\p{Lu}/u.test(token)) &&
			!GENERIC_ACTORS.has(key)
		) {
			this.personTokens.add(key)
			this.setToken(key, fake)
		}
		return fake
	}

	/** "Mary Ann Smith": each token mapped on its own, so partial copies stay consistent. */
	private fakePerson(name: string, requireCapital = false): string {
		if (
			name
				.trim()
				.split(/\s+/)
				.every((t) => GENERIC_ACTORS.has(t.toLowerCase()))
		)
			return name
		const fake = name
			.trim()
			.split(/\s+/)
			.map((token) => this.personToken(token, requireCapital))
			.join(' ')
		this.setPhrase(name, fake, true)
		return fake
	}

	private fakeCompany(name: string): string {
		const h = this.hash('company', normalizeName(name))
		const fake = `${COMPANY_WORDS[h % COMPANY_WORDS.length]} ${COMPANY_WORDS[(h >>> 8) % COMPANY_WORDS.length]} ${COMPANY_SUFFIXES[(h >>> 16) % COMPANY_SUFFIXES.length]}`
		for (const token of name.trim().split(/\s+/)) {
			const key = token.toLowerCase()
			if (key.length < MIN_TOKEN || COMPANY_STOPWORDS.has(key) || this.personTokens.has(key)) {
				continue
			}
			this.companyTokens.add(key)
			this.setToken(key, this.pick(COMPANY_WORDS, 'company-word', token))
		}
		this.setPhrase(name, fake)
		// "Harbour Lodge Pty Ltd" is also written as "harbour lodge" / "harbour-lodge".
		const core = name
			.trim()
			.split(/\s+/)
			.filter((token) => !COMPANY_STOPWORDS.has(token.toLowerCase()))
		if (core.length > 1 && core.every((token) => token.length >= MIN_TOKEN))
			this.setPhrase(core.join(' '), fake.split(' ').slice(0, 2).join(' '))
		return fake
	}

	private setToken(key: string, fake: string): void {
		if (this.tokens.get(key) === fake) return
		this.tokens.set(key, fake)
		this.dirty = true
	}

	private setPhrase(name: string, fake: string, person = false): void {
		const key = normalizeName(name)
		if (!key.includes(' ') || this.phrases.get(key) === fake) return
		if (person) this.personPhrases.add(key)
		else if (this.personPhrases.has(key)) return
		this.phrases.set(key, fake)
		this.dirty = true
	}

	private fakeEmail(email: string): string {
		const h = this.hash('email', email.toLowerCase())
		const local =
			`${FIRST_NAMES[h % FIRST_NAMES.length]}.${LAST_NAMES[(h >>> 8) % LAST_NAMES.length]}.${(h >>> 16).toString(16).slice(0, 4)}`.toLowerCase()
		const domain = this.config.preserveEmailDomain
			? email.split('@')[1]!.toLowerCase()
			: 'example.test'
		return `${local}@${domain}`
	}

	/**
	 * Map keys and document ids: replaced only when the whole identifier is an
	 * email or a learned full name (keeping its separator style), so ordinary
	 * keys like "price" or "page" are never renamed.
	 */
	private scrubIdentifier(id: string): string {
		if (EMAIL_EXACT.test(id)) return this.fakeEmail(id)
		const phrase = this.phraseReplacement(id)
		if (phrase) return phrase
		// A whole id or key that is a learned person's name ("marisol"), unless it's an ordinary word.
		const lower = id.toLowerCase()
		if (this.personTokens.has(lower) && !COMMON_WORDS.has(lower)) {
			return matchCase(id, this.tokens.get(lower) ?? id)
		}
		return id
	}

	/** Fake for a whole learned full name, in the original's separator style and casing. */
	private phraseReplacement(text: string): string | undefined {
		const fake = this.phrases.get(normalizeName(text))
		if (!fake) return undefined
		const separator = /[\s._-]/.exec(text.trim())?.[0] ?? ' '
		return matchCase(text, fake.split(' ').join(separator))
	}

	/**
	 * Replaces emails and learned names inside a value. Emails are masked first
	 * so a learned name never rewrites part of a real email (which would break
	 * the email -> fake mapping). Enum values are left alone; common-word names
	 * ("grant", "page") are only replaced when capitalized.
	 */
	private scrubText(text: string, context: TextContext): string {
		const emails: string[] = []
		const sentinel = `${this.hash('mask', text) % 1e6}:`
		let out = text
		if (this.config.scrubEmailsInText) {
			out = out.replace(EMAIL, (match) => `${sentinel}${emails.push(match) - 1}`)
		}
		const pattern = this.namePattern()
		const isEnumValue = context === 'enum' && ENUM_VALUE.test(text) && !this.mentionsPerson(text)
		if (pattern && !isEnumValue) {
			out = out.replace(pattern, (match) => {
				const phrase = this.phraseReplacement(match)
				if (phrase) return phrase
				const lower = match.toLowerCase()
				const lowercase = !/^\p{Lu}/u.test(match)
				if (context !== 'keywords' && lowercase) {
					if (COMMON_WORDS.has(lower)) return match
					// "lodge" in `action: "lodge"` is a verb, not "Harbour Lodge".
					if (this.companyTokens.has(lower) && !this.personTokens.has(lower)) return match
				}
				return matchCase(match, this.tokens.get(lower) ?? match)
			})
		}
		if (context !== 'enum') {
			out = out.replace(LABELLED_NUMBER, (_, label: string, gap: string, number: string) => {
				// "TFN 123456782 2024-06-01": only the number is replaced, not the date after it.
				const value = number.split(TRAILING_DATE)[0] ?? number
				return `${label}${gap}${this.fakeDigits(value, 'tax')}${number.slice(value.length)}`
			})
			out = out.replace(PHONE_IN_TEXT, (match) => this.fakePhoneLike(match))
			// After phones, so a phone's digit groups keep their phone format.
			out = out.replace(GROUPED_ID, (match) => this.fakeDigits(match, 'tax'))
		}
		if (!emails.length) return out
		const restore = new RegExp(`${escapeRegex(sentinel)}(\\d+)`, 'g')
		return out.replace(restore, (match, i: string) => {
			const email = emails[Number(i)]
			return email ? this.fakeEmail(email) : match
		})
	}

	/** Replaces every digit (keeping letters, spaces and dashes), deterministic per original. */
	private fakeDigits(original: string, kind: string): string {
		// One HMAC per number; its bytes (then a counter) supply the digits.
		let seed = this.hash(kind, original)
		return original.replace(/\d/g, () => {
			seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
			return String((seed >>> 16) % 10)
		})
	}

	/** Replaces the digits of a phone number found in text, keeping its format ("+61 412 555 019"). */
	private fakePhoneLike(match: string): string {
		const digits = match.replace(/\D/g, '')
		if (digits.length < 8 || digits.length > 15) return match
		// Dates (01.02.2024), decimals (0.123456789), accounting negatives ((1234567.89)) and
		// zero-padded references (00012345, three or more leading zeros) aren't phone numbers.
		if (/^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}$/.test(match)) return match
		if (/^\(?-?\d+\.\d+\)?$/.test(match)) return match
		if (/^000\d*$/.test(match)) return match
		let index = 0
		return match.replace(/\d/g, (digit) => {
			const i = index++
			// Keep the leading digit (country code or trunk 0) so the format still reads as a phone.
			return i === 0 ? digit : String(this.hash('phone-digit', `${digits}:${i}`) % 10)
		})
	}

	/** True when a short value is (part of) a learned person's name, e.g. "marisol.okafor". */
	private mentionsPerson(text: string): boolean {
		if (this.phrases.has(normalizeName(text))) return true
		return text
			.toLowerCase()
			.split(SLUG_SEPARATORS)
			.some((part) => this.personTokens.has(part) && !COMMON_WORDS.has(part))
	}

	/** Whole-word, case-insensitive match of learned names (longest first), rebuilt only after learning. */
	private namePattern(): RegExp | null {
		if (this.dirty) {
			const phrases = [...this.phrases.keys()].map((p) =>
				p.split(' ').map(escapeRegex).join('[\\s._-]+')
			)
			const tokens = [...this.tokens.keys()].map(escapeRegex)
			const all = [...phrases, ...tokens].sort((a, b) => b.length - a.length)
			this.pattern = all.length
				? new RegExp(`(?<![\\p{L}\\d])(?:${all.join('|')})(?![\\p{L}\\d])`, 'giu')
				: null
			this.dirty = false
		}
		return this.pattern
	}

	/** Pure-JS HMAC so the same code runs in Node and in the browser; memoized (hashes repeat a lot). */
	private hash(kind: string, value: string): number {
		const input = `${kind}:${value}`
		let result = this.hashes.get(input)
		if (result === undefined) {
			const mac = hmac(sha256, this.saltBytes, encoder.encode(input))
			result = ((mac[0]! << 24) | (mac[1]! << 16) | (mac[2]! << 8) | mac[3]!) >>> 0
			this.hashes.set(input, result)
		}
		return result
	}
}
