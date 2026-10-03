import { beforeEach, describe, expect, it } from 'vitest'
import type { FsFields, FsValue } from '#shared/types/firestore'
import { Anonymizer } from '../anonymizer'
import { DEFAULT_CONFIG } from '../config'
import { FIRST_NAMES, LAST_NAMES } from '../fakeData'

const str = (v: string) => ({ t: 'string', v }) as const
const text = (value: FsValue | undefined) => (value?.t === 'string' ? value.v : '')

/** Runs both passes over a set of documents, like a snapshot export. */
function anonymizeAll(anonymizer: Anonymizer, docs: Record<string, FsFields>) {
	for (const [path, fields] of Object.entries(docs)) anonymizer.learn(fields, path)
	return Object.fromEntries(
		Object.entries(docs).map(([path, fields]) => [
			anonymizer.path(path),
			anonymizer.fields(fields, path)
		])
	)
}

describe('Anonymizer', () => {
	let anonymizer: Anonymizer
	beforeEach(() => {
		anonymizer = new Anonymizer(DEFAULT_CONFIG, 'test-salt')
	})

	it('removes PII while keeping shape, types and non-personal values', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/abc': {
				email: str('d.whitcombe@ledgerline.example'),
				firstName: str('Delphine'),
				lastName: str('Whitcombe'),
				accountRole: str('team'),
				companies: { t: 'array', v: [str('2YRFHbbOPCDbD6AiXxfV')] },
				mfa: {
					t: 'map',
					v: { totpSecret: str('JBSWY3DPEHPK3PXP'), enrolledAt: { t: 'timestamp', s: 1, n: 0 } }
				}
			}
		})['tenant/x/users/abc']!
		expect(JSON.stringify(out)).not.toMatch(/Delphine|Whitcombe|ledgerline|JBSWY3DP/i)
		expect(out.accountRole).toEqual(str('team'))
		expect(out.companies).toEqual({ t: 'array', v: [str('2YRFHbbOPCDbD6AiXxfV')] })
		expect(out.mfa).toMatchObject({
			v: { totpSecret: str('[redacted]'), enrolledAt: { t: 'timestamp' } }
		})
		expect(text(out.email)).toMatch(/@example\.test$/)
	})

	it('maps the same real email to the same fake in fields, text, references, keys and ids', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/abc': {
				firstName: str('Casey'),
				lastName: str('Lee'),
				email: str('casey.lee@acme.com'),
				bio: str('Contact casey.lee@acme.com or Casey'),
				manager: { t: 'reference', v: 'emailClaims/casey.lee@acme.com' },
				permissions: { t: 'map', v: { 'casey.lee@acme.com': str('admin') } }
			}
		})['tenant/x/users/abc']!
		const fake = text(out.email)
		expect(text(out.bio)).toContain(fake)
		expect(out.manager).toEqual({ t: 'reference', v: `emailClaims/${fake}` })
		expect(Object.keys(out.permissions!.t === 'map' ? out.permissions!.v : {})).toEqual([fake])
		expect(JSON.stringify(out)).not.toMatch(/acme\.com|casey|\blee\b/i)
	})

	it('replaces learned names wherever they were copied, keeping uids and non-person "...By" keys', () => {
		const docs = anonymizeAll(anonymizer, {
			'tenant/x/users/u1': { firstName: str('Marisol'), lastName: str('Okafor') },
			'tenant/x/audit_logs/l1': {
				userName: str('Marisol Okafor'),
				basLodgedBy: str('Marisol'),
				createdBy: str('Xq3uV8nLc2TzR7pWk1YbHd5sJ9aE'),
				approvedBy: str('john.smith2@acme.com'),
				sortBy: str('createdAt'),
				summary: str('Approved by marisol okafor today'),
				nameLower: str('marisol okafor')
			}
		})
		const out = docs['tenant/x/audit_logs/l1']!
		expect(JSON.stringify(out)).not.toMatch(/marisol|okafor|john\.smith|acme/i)
		expect(out.createdBy).toEqual(str('Xq3uV8nLc2TzR7pWk1YbHd5sJ9aE'))
		expect(out.sortBy).toEqual(str('createdAt'))
		expect(text(out.basLodgedBy)).toBe(text(out.userName).split(' ')[0])
		expect(text(out.summary)).toBe(`Approved by ${text(out.userName).toLowerCase()} today`)
	})

	it('learns every token of a name, including middle names', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/u1': { displayName: str('Mary Ann Smith') },
			'tenant/x/notes_meta/n1': { summary: str('Ann called about the BAS') }
		})
		expect(JSON.stringify(out)).not.toMatch(/\bAnn\b|Mary|Smith/)
	})

	it('anonymizes company names and document ids made of learned names', () => {
		const docs = anonymizeAll(anonymizer, {
			'tenant/x/companies/c1': { name: str('Seaview Lofts Pty Ltd') },
			'tenant/x/users/u1': { firstName: str('Delphine'), lastName: str('Whitcombe') },
			'tenant/x/users/delphine-whitcombe': { role: str('team') },
			'tenant/x/tasks/t1': { title: str('BAS for Seaview Lofts'), status: str('open') }
		})
		const serialized = JSON.stringify(docs)
		expect(serialized).not.toMatch(/Seaview|Lofts|delphine|grant/i)
		expect(docs['tenant/x/tasks/t1']!.status).toEqual(str('open'))
	})

	it('redacts common secret field names', () => {
		const out = anonymizer.fields(
			{
				fcmToken: str('fcm-real'),
				authToken: str('auth-real'),
				webhookSecret: str('whsec-real'),
				stripeSecret: str('sk-real'),
				inviteTokens: { t: 'array', v: [str('inv-real')] },
				tokenCount: { t: 'number', v: 3 }
			},
			'tenant/x/integrations/i1'
		)
		expect(JSON.stringify(out)).not.toMatch(/-real/)
		expect(out.tokenCount).toEqual({ t: 'number', v: 3 })
	})

	it('does not rewrite lowercase enum values that happen to match a learned surname', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/u1': { lastName: str('Brown') },
			'tenant/x/tasks/t1': { colour: str('brown') }
		})
		expect(out['tenant/x/tasks/t1']!.colour).toEqual(str('brown'))
	})

	it('never maps a real name to itself, including names that are in the fake lists', () => {
		for (const name of [...FIRST_NAMES, ...LAST_NAMES]) {
			const out = new Anonymizer(DEFAULT_CONFIG, 'test-salt').fields(
				{ firstName: str(name) },
				'tenant/x/users/u1'
			)
			expect(text(out.firstName).toLowerCase()).not.toBe(name.toLowerCase())
		}
	})

	it('replaces lowercase copies of names in keyword arrays, slugs and handles', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/u1': {
				firstName: str('Marisol'),
				lastName: str('Okafor'),
				searchKeywords: { t: 'array', v: [str('marisol'), str('okafor')] },
				slug: str('marisol-okafor'),
				handle: str('marisol')
			}
		})
		expect(JSON.stringify(out)).not.toMatch(/marisol|okafor/i)
	})

	it('never renames field names or ordinary words, even when they match learned names', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/companies/c1': { name: str('The Price Family Trust') },
			'tenant/x/users/u1': { displayName: str('Grant Page') },
			'tenant/x/invoices/i1': {
				price: { t: 'number', v: 10 },
				page: { t: 'number', v: 2 },
				lines: { t: 'map', v: { price: { t: 'number', v: 5 }, the: str('x') } },
				memo: str('the report for the accounting team, grant approved')
			},
			'tenant/x/settings/page': { enabled: { t: 'boolean', v: true } }
		})
		const invoice = out['tenant/x/invoices/i1']!
		expect(Object.keys(invoice).sort()).toEqual(['lines', 'memo', 'page', 'price'])
		expect(Object.keys(invoice.lines!.t === 'map' ? invoice.lines!.v : {}).sort()).toEqual([
			'price',
			'the'
		])
		expect(invoice.memo).toEqual(str('the report for the accounting team, grant approved'))
		expect(out['tenant/x/settings/page']).toBeDefined()
	})

	it('produces the same output whatever order documents are learned in', () => {
		const docs: Record<string, FsFields> = {
			'tenant/x/users/u1': { displayName: str('Marisol Okafor') },
			'tenant/x/companies/c1': { name: str('Okafor Plumbing') },
			'tenant/x/tasks/t1': { title: str('Call Okafor about Marisol') }
		}
		const reversed = Object.fromEntries(Object.entries(docs).reverse())
		const a = anonymizeAll(new Anonymizer(DEFAULT_CONFIG, 's'), docs)
		const b = anonymizeAll(new Anonymizer(DEFAULT_CONFIG, 's'), reversed)
		expect(a['tenant/x/tasks/t1']).toEqual(b['tenant/x/tasks/t1'])
		expect(a['tenant/x/users/u1']).toEqual(b['tenant/x/users/u1'])
	})

	it('does not crash on text shaped like the old email placeholder', () => {
		expect(() =>
			anonymizer.fields({ note2: str('\uE0000\uE000 a@b.co \uE0001\uE000') }, 'tenant/x/misc/m1')
		).not.toThrow()
	})

	it('still replaces names in prose stored under enum-like keys, but keeps real enum values', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/u1': { firstName: str('Marisol'), lastName: str('Okafor') },
			'tenant/x/leads/l1': {
				referralSource: str('Marisol Okafor'),
				estate: str('Estate of Marisol Okafor'),
				businessPlan: str('Call Marisol about it'),
				status: str('active'),
				accountRole: str('team')
			}
		})
		const lead = out['tenant/x/leads/l1']!
		expect(JSON.stringify(lead)).not.toMatch(/marisol|okafor/i)
		expect(lead.status).toEqual(str('active'))
		expect(lead.accountRole).toEqual(str('team'))
	})

	it('replaces a learned first name used as a whole map key or document id', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/u1': { firstName: str('Marisol'), lastName: str('Okafor') },
			'tenant/x/users/marisol': { approvals: { t: 'map', v: { marisol: { t: 'boolean', v: true } } } }
		})
		expect(JSON.stringify(out)).not.toMatch(/marisol/i)
	})

	it('replaces single-word names under enum-like keys', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/u1': { firstName: str('Marisol'), lastName: str('Okafor') },
			'tenant/x/leads/l1': {
				referralSource: str('Marisol'),
				ownerRole: str('marisol.okafor'),
				leadSource: str('marisol-okafor')
			}
		})
		expect(JSON.stringify(out['tenant/x/leads/l1'])).not.toMatch(/marisol|okafor/i)
	})

	it('never learns roles or system actors as names, so keys and ids like "admin" survive', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/audit_logs/a1': {
				createdBy: str('system'),
				updatedBy: str('admin'),
				displayName: str('Support Team'),
				roles: {
					t: 'map',
					v: { admin: { t: 'boolean', v: true }, team: { t: 'boolean', v: true } }
				}
			},
			'tenant/x/settings/admin': { enabled: { t: 'boolean', v: true } }
		})
		const log = out['tenant/x/audit_logs/a1']!
		expect(log.createdBy).toEqual(str('system'))
		expect(Object.keys(log.roles!.t === 'map' ? log.roles!.v : {}).sort()).toEqual([
			'admin',
			'team'
		])
		expect(out['tenant/x/settings/admin']).toBeDefined()
	})

	it('keeps lowercase machine values that share a word with a company name', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/companies/c1': { name: str('Harbour Lodge Pty Ltd') },
			'tenant/x/events/e1': {
				action: str('lodge'),
				eventName: str('lodge_bas'),
				note2: str('Sent to Harbour Lodge')
			}
		})
		const event = out['tenant/x/events/e1']!
		expect(event.action).toEqual(str('lodge'))
		expect(event.eventName).toEqual(str('lodge_bas'))
		expect(JSON.stringify(event.note2)).not.toMatch(/Harbour|Lodge/)
	})

	it('learns lowercase names from explicit name fields', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/users/u1': { firstName: str('marisol'), lastName: str('okafor') },
			'tenant/x/tasks/t1': { title: str('call marisol okafor') }
		})
		expect(JSON.stringify(out)).not.toMatch(/marisol|okafor/i)
	})

	it('replaces lowercase phrases and slugs of company names', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/companies/c1': { name: str('Harbour Lodge Pty Ltd') },
			'tenant/x/invoices/i1': { memo: str('invoice for harbour lodge, see harbour-lodge') }
		})
		expect(JSON.stringify(out['tenant/x/invoices/i1'])).not.toMatch(/harbour|lodge/i)
	})

	it('keeps a person phrase stable when a company shares the name, in any order', () => {
		const docs: Record<string, FsFields> = {
			'tenant/x/companies/c1': { name: str('Delphine Whitcombe Bookkeeping') },
			'tenant/x/users/u1': { firstName: str('Delphine'), lastName: str('Whitcombe') },
			'tenant/x/users/delphine-whitcombe': { role: str('team') }
		}
		const a = anonymizeAll(new Anonymizer(DEFAULT_CONFIG, 's'), docs)
		const b = anonymizeAll(
			new Anonymizer(DEFAULT_CONFIG, 's'),
			Object.fromEntries(Object.entries(docs).reverse())
		)
		const user = a['tenant/x/users/u1']!
		const expectedId = `tenant/x/users/${text(user.firstName)}-${text(user.lastName)}`.toLowerCase()
		expect(Object.keys(a)).toContain(expectedId)
		expect(Object.keys(b)).toContain(expectedId)
	})

	it('does not learn short-word company cores that would match ordinary text', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/companies/c1': { name: str('A B Pty Ltd') },
			'tenant/x/notes_meta/n1': { summary: str('see a b c') }
		})
		expect(out['tenant/x/notes_meta/n1']!.summary).toEqual(str('see a b c'))
	})

	it('anonymizes prefixed address, phone and tax keys and phone numbers inside text', () => {
		const out = anonymizeAll(anonymizer, {
			'tenant/x/clients/c1': {
				homeAddress: str('17 Kestrel Rise, Mosman NSW 2088'),
				residentialAddress: {
					t: 'map',
					v: {
						line1: str('17 Kestrel Rise'),
						suburb: str('Mosman'),
						postcode: str('2088'),
						state: str('NSW')
					}
				},
				contactNumber: str('+61 412 555 019'),
				employerAbn: str('51 824 753 556'),
				description: str('Call Jamie on +61 412 555 019 or 0412 555 019'),
				billingCity: str('Mosman'),
				capacity: { t: 'number', v: 4 },
				amount: str('1,234,567.00'),
				dueDate: str('2026-10-03')
			}
		})
		const client = out['tenant/x/clients/c1']!
		expect(JSON.stringify(client)).not.toMatch(/Kestrel|Mosman|412 555 019|0412|824 753|2088/)
		expect(client.residentialAddress).toMatchObject({ v: { state: str('NSW') } })
		const postcode =
			client.residentialAddress!.t === 'map' ? client.residentialAddress!.v.postcode : undefined
		expect(text(postcode)).toMatch(/^\d{4}$/)
		expect(client.capacity).toEqual({ t: 'number', v: 4 })
		expect(client.amount).toEqual(str('1,234,567.00'))
		expect(client.dueDate).toEqual(str('2026-10-03'))
		expect(text(client.description)).toMatch(
			/^Call \S+ on \+6\d \d{3} \d{3} \d{3} or 0\d{3} \d{3} \d{3}$/
		)
	})

	it('leaves ids, dates and amounts that contain digit runs alone', () => {
		const values = {
			uuid: str('9c41e2a7-63b0-4d8e-a1f5-27e8d0b6c3f9'),
			iso: str('2026-10-03T09:00:00.000Z'),
			path: str('files/0412-555-019/report.pdf'),
			note2: str('ref 9c41e2a7-63b0-4d8e-a1f5-27e8d0b6c3f9 at 10:30')
		}
		expect(anonymizer.fields(values, 'tenant/x/misc/m1')).toEqual(values)
	})

	it('keeps non-address fields that look like address parts or phones', () => {
		const values = {
			unit: str('hours'),
			line1: str('Consulting services'),
			webAddress: str('https://example.com'),
			walletAddress: str('0xabc123'),
			cells: str('A1:B2'),
			note2: str('dated 01.02.2024, rate 0.123456789, total (1234567.89), Invoice 00012345')
		}
		expect(anonymizer.fields(values, 'tenant/x/invoices/i1')).toEqual(values)
	})

	it('anonymizes address line and unit parts and rounds coordinates inside addresses', () => {
		const out = anonymizer.fields(
			{
				address: {
					t: 'map',
					v: {
						line1: str('17 Kestrel Rise'),
						unit: str('4B'),
						lat: { t: 'number', v: -33.82947 },
						geo: { t: 'geopoint', lat: -33.82947, lng: 151.24611 }
					}
				},
				deviceIpAddress: str('10.1.2.3')
			},
			'tenant/x/clients/c1'
		)
		expect(JSON.stringify(out)).not.toMatch(/Kestrel|4B|82947|24611|10\.1\.2\.3/)
		expect(out.address).toMatchObject({
			v: { lat: { t: 'number', v: -33.8 }, geo: { t: 'geopoint', lat: -33.8, lng: 151.2 } }
		})
	})

	it('replaces site and shipping addresses and unbroken phone runs', () => {
		const out = anonymizer.fields(
			{
				siteAddress: str('12 Real St Bondi'),
				jobSiteAddress: str('12 Real St Bondi'),
				shipAddress: str('12 Real St Bondi'),
				note2: str('call 0061412345678 or 07911123456')
			},
			'tenant/x/jobs/j1'
		)
		expect(JSON.stringify(out)).not.toMatch(/Real St|0061412345678|07911123456/)
		expect(text(out.shipAddress)).toMatch(/\d+ \w+/)
	})

	it('replaces camelCase ip keys', () => {
		const out = anonymizer.fields(
			{ remoteIp: str('10.0.0.1'), lastIp: str('10.0.0.2'), clientIpAddress: str('10.0.0.3') },
			'tenant/x/sessions/s1'
		)
		expect(JSON.stringify(out)).not.toMatch(/10\.0\.0\./)
	})

	it('replaces tax and bank numbers written in free text', () => {
		const out = anonymizer.fields(
			{
				note2: str('ABN 51 824 753 556 for the client, TFN: 123456782'),
				summary: str('Pay to BSB 062-000 acct 12345678, ACN 004 085 616'),
				ref: str('client 51 824 753 556')
			},
			'tenant/x/misc/m1'
		)
		expect(JSON.stringify(out)).not.toMatch(/824 753 556|123456782|062-000|12345678|004 085 616/)
		expect(text(out.note2)).toMatch(/^ABN \d\d \d{3} \d{3} \d{3} for the client, TFN: \d{9}$/)
	})

	it('replaces tax numbers followed by punctuation or after a few words, not dates after them', () => {
		const out = anonymizer.fields(
			{
				a: str('My TFN is 123 456 782.'),
				b: str('ABN is 51 824 753 556, thanks'),
				c: str('TFN 123456782 2024-06-01'),
				d: str('total 1,234,567.00 and 1.5')
			},
			'tenant/x/misc/m1'
		)
		expect(JSON.stringify(out)).not.toMatch(/456 782|753 556|123456782/)
		expect(text(out.c)).toMatch(/^TFN \d{9} 2024-06-01$/)
		expect(out.d).toEqual(str('total 1,234,567.00 and 1.5'))
	})

	it('handles long whitespace after a label quickly (no catastrophic backtracking)', () => {
		const started = performance.now()
		anonymizer.fields(
			{ a: str(`Account${' '.repeat(40)}Balance`), b: str(`ABN${' '.repeat(40)}x`) },
			'tenant/x/misc/m1'
		)
		expect(performance.now() - started).toBeLessThan(200)
	})

	it('scans long unbroken tokens and repeated filler words quickly', () => {
		const started = performance.now()
		anonymizer.fields(
			{
				blob: str('a'.repeat(100_000)),
				token: str(`${'x9_-.'.repeat(20_000)}@`),
				filler: str(`TFN${' is'.repeat(40)} x`)
			},
			'tenant/x/misc/m1'
		)
		expect(performance.now() - started).toBeLessThan(500)
	})

	it('replaces column-aligned labelled numbers', () => {
		const out = anonymizer.fields(
			{ a: str('Account No:          12345678'), b: str(`Account${' '.repeat(20_000)}x`) },
			'tenant/x/misc/m1'
		)
		expect(text(out.a)).not.toContain('12345678')
		expect(text(out.a)).toMatch(/^Account No: {10}\d{8}$/)
	})

	it('replaces very long digit runs after a label quickly', () => {
		const started = performance.now()
		anonymizer.fields({ a: str(`ABN ${'1 '.repeat(100_000)}`) }, 'tenant/x/misc/m1')
		expect(performance.now() - started).toBeLessThan(500)
	})

	it('replaces every digit of a long labelled number', () => {
		const real = '1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 4242'
		const out = anonymizer.fields({ a: str(`Account number: ${real}`) }, 'tenant/x/misc/m1')
		expect(text(out.a)).not.toContain('4242')
		expect(text(out.a)).not.toContain(real)
	})
})
