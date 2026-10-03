/** Small fixed word lists: fakes only need to look plausible, not be diverse. */
export const FIRST_NAMES = [
	'Alex',
	'Sam',
	'Jordan',
	'Taylor',
	'Morgan',
	'Casey',
	'Riley',
	'Jamie',
	'Avery',
	'Quinn',
	'Charlie',
	'Harper',
	'Rowan',
	'Emerson',
	'Finley',
	'Hayden',
	'Kai',
	'Logan',
	'Parker',
	'Reese'
]

export const LAST_NAMES = [
	'Smith',
	'Jones',
	'Brown',
	'Wilson',
	'Taylor',
	'Nguyen',
	'Martin',
	'Lee',
	'Walker',
	'Hall',
	'Young',
	'King',
	'Wright',
	'Scott',
	'Green',
	'Baker',
	'Adams',
	'Nelson',
	'Hill',
	'Campbell'
]

export const COMPANY_WORDS = [
	'Acme',
	'Northwind',
	'Bluegum',
	'Harbour',
	'Summit',
	'Riverside',
	'Granite',
	'Silverleaf',
	'Coastal',
	'Ironbark',
	'Meadow',
	'Pinnacle',
	'Redwood',
	'Sterling',
	'Wattle',
	'Horizon'
]

export const COMPANY_SUFFIXES = [
	'Pty Ltd',
	'Holdings',
	'Trading',
	'Group',
	'Services',
	'Trust',
	'Co'
]

export const LOCALITIES = ['Exampleton', 'Sampleville', 'Testfield', 'Demoburg', 'Mockford']

export const STREETS = ['Example St', 'Sample Rd', 'Test Ave', 'Demo Lane', 'Placeholder Way']

const LOREM =
	'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat'.split(
		' '
	)

/** Lorem text of roughly `length` characters, starting at a word picked by `seed`. */
export function lorem(length: number, seed: number): string {
	const words: string[] = []
	let size = 0
	for (let i = seed; size < Math.max(length, 5); i++) {
		const word = LOREM[i % LOREM.length]!
		words.push(word)
		size += word.length + 1
	}
	return words.join(' ').slice(0, Math.max(length, 5))
}
