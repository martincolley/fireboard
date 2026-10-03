/** ISO 8601 string with full nanosecond precision, e.g. 2026-10-03T09:00:00.123456789Z */
export function timestampToIso(s: number, n: number): string {
	const base = new Date(s * 1000).toISOString().replace(/\.\d{3}Z$/, '')
	return `${base}.${String(n).padStart(9, '0')}Z`
}

/** Parses any ISO 8601 string (with or without fractional seconds) into seconds + nanos. */
export function isoToTimestamp(iso: string): { s: number; n: number } {
	const match = /^(.*?)(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})?$/.exec(iso.trim())
	const fraction = match?.[2] ?? ''
	const wholeIso = `${match?.[1] ?? iso}${match?.[3] ?? 'Z'}`
	const ms = Date.parse(wholeIso)
	if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${iso}`)
	return { s: Math.floor(ms / 1000), n: Number(fraction.padEnd(9, '0')) }
}
