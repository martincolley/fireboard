/**
 * Every built-in rule that earlier versions wrote into anonymize.json (keys with
 * backslashes removed). Used to tell a user's own rules apart from stale
 * defaults when migrating an old full-copy file.
 */
export const LEGACY_DEFAULT_RULES: ReadonlyArray<readonly [string, string]> = [
	[
		'.*(password|passcode|secret|token|api_?key|private_?key|salt|otp|recovery_?codes?)s?|pin|.*_hash|.*password_?hash',
		'redact'
	],
	[
		'((employer|employee|client|customer|business|company|entity|personal|payee|payer|supplier|vendor|staff|director|trustee|beneficiary|partner|member|user|owner)_?|.*_)?(tfn|abn|acn|ein|vat_?number|gst_?number|ssn|sin|nino|tax_?(id|number|file_?number)|bsb|iban|swift|bic|(bank_?)?account_?number|bank_?account|routing_?number|card_?number|credit_?card|cvv|passport(_?number)?|drivers?_?licen[cs]e|licen[cs]e_?number|medicare(_?number)?)',
		'redact'
	],
	['.*e-?mail(_?address)?(es|s)?', 'email'],
	['(first|given|preferred|middle)_?name', 'firstName'],
	['(last|family|sur)_?name|surname', 'lastName'],
	[
		'.*(company|business|trading|legal|entity|client|organi[sz]ation|org|firm)_?name(_?lower)?',
		'company'
	],
	['(full|display|contact)_?name(_?lower)?', 'fullName'],
	['name(_?lower)?', 'fullName'],
	['name(_?lower)?', 'company'],
	[
		'.*(user|owner|author|creator|assignee|actor|member|contact|sender|recipient|person)_?name(_?lower)?',
		'fullName'
	],
	[
		'(created|updated|modified|deleted|approved|lodged|assigned|submitted|reviewed|owned|completed|performed|invited|requested|sent|signed|uploaded|archived|closed|resolved|added|removed|changed|edited|verified|prepared|filed)_?by(_?name)?|.*(lodged|performed|prepared|filed)_?by',
		'person'
	],
	[
		'.*(phone|mobile|telephone|fax|contact_?number|whats_?app)(_?number)?s?|tel|(.*_)?cell(_?(phone|number))?',
		'phone'
	],
	[
		'(.*_)?ip(_?address)?|.*(device|client|user|remote|last|server|public|private|local)_?ip(_?address)?',
		'ip'
	],
	[
		'.*(web|website|url|wallet|mac|server|host|contract|bitcoin|eth|ens|smart_?contract)_?address(es)?',
		'keep'
	],
	['.*(post_?code|postal_?code|zip(_?code)?)', 'postcode'],
	[
		'(.*_)?(suburb|city|town|locality)|.*(home|postal|billing|mailing|residential|business|work|shipping|delivery|street)_?(suburb|city|town|locality)',
		'locality'
	],
	['.*address(_?line_?d?)?(es)?|.*street(_?address|_?name|_?number)?|address_?line_?d?', 'address'],
	['state|country(_?code)?|region|province', 'keep'],
	['dob|date_?of_?birth|birth_?date|birthday', 'date'],
	['body|content|html|text|message|notes?|comment|transcript|body_?(html|text)|snippet', 'lorem'],
	[
		'(.*_)?ip(_?address)?|.*(device|client|user|remote|last|server|public|private|local)_?ip_?address',
		'ip'
	],
	['(.*_)?ip(_?address)?|.*[a-z]ip_?address', 'ip'],
	[
		'.*(web|website|site|url|wallet|mac|server|host|contract|bitcoin|eth|ens|smart_?contract)_?address(es)?',
		'keep'
	],
	['.*(phone|mobile|telephone|fax|cell|contact_?number|whats_?app)(_?number)?s?|tel', 'phone'],
	['(last_?|remote_?|client_?|user_?)?ip(_?address)?', 'ip'],
	[
		'.*address(_?line_?d?)?(es)?|.*street(_?address|_?name|_?number)?|address_?line_?d?|line_?[1-4]|unit(_?number)?',
		'address'
	],
	[
		'(tfn|abn|acn|ein|vat_?number|gst_?number|ssn|sin|nino|tax_?(id|number|file_?number)|bsb|iban|swift|bic|(bank_?)?account_?number|bank_?account|routing_?number|card_?number|credit_?card|cvv|passport(_?number)?|drivers?_?licen[cs]e|licen[cs]e_?number|medicare(_?number)?)',
		'redact'
	],
	['.*(phone|mobile|telephone|fax)(_?number)?s?|tel', 'phone'],
	['address|street(_?address)?|address_?line_?d?|post_?code|postal_?code|zip(_?code)?', 'address'],
	['(last_?|remote_?)?ip(_?address)?', 'ip'],
	[
		'(password|passwordhash|pin|secret|clientsecret|api_?key|private_?key|(access|refresh|id|session)?_?token|totp_?secret|mfa_?secret|otp|recovery_?codes?)',
		'redact'
	],
	['(full|display|contact|legal)_?name', 'fullName'],
	[
		'.*(user|owner|author|creator|assignee|actor|member|contact|client|sender|recipient|person)_?name(_?lower)?',
		'fullName'
	],
	['.*_?by(_?name)?', 'person']
]
