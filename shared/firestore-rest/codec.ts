import type { FsDoc, FsFields, FsValue } from '../types/firestore'
import { isoToTimestamp, timestampToIso } from '../utils/timestamp'

/** Firestore REST `Value` (https://firebase.google.com/docs/firestore/reference/rest/v1/Value). */
export type RestValue =
	| { nullValue: null }
	| { booleanValue: boolean }
	| { integerValue: string }
	| { doubleValue: number | string }
	| { timestampValue: string }
	| { stringValue: string }
	| { bytesValue: string }
	| { referenceValue: string }
	| { geoPointValue: { latitude?: number; longitude?: number } }
	| { arrayValue: { values?: RestValue[] } }
	| { mapValue: { fields?: Record<string, RestValue> } }

export interface RestDocument {
	name: string
	fields?: Record<string, RestValue>
	createTime?: string
	updateTime?: string
}

/** "projects/p/databases/d/documents" */
export function documentsRoot(projectId: string, databaseId: string): string {
	return `projects/${projectId}/databases/${databaseId}/documents`
}

/** Full resource name of a document path. */
export function documentName(projectId: string, databaseId: string, path: string): string {
	return `${documentsRoot(projectId, databaseId)}/${path}`
}

/** Document path ("users/abc") from a full resource name. */
export function pathFromName(name: string): string {
	// The first "/documents/" ends the database root; later ones may be a collection named "documents".
	const index = name.indexOf('/documents/')
	return index === -1 ? '' : name.slice(index + '/documents/'.length)
}

const VECTOR_TYPE = '__vector__'

/** FsValue -> REST Value. References need the project/database to build a full name. */
export function toRestValue(value: FsValue, projectId: string, databaseId: string): RestValue {
	switch (value.t) {
		case 'null':
			return { nullValue: null }
		case 'boolean':
			return { booleanValue: value.v }
		case 'number':
			return Number.isInteger(value.v)
				? { integerValue: String(value.v) }
				: { doubleValue: Number.isFinite(value.v) ? value.v : String(value.v) }
		case 'string':
			return { stringValue: value.v }
		case 'timestamp':
			return { timestampValue: timestampToIso(value.s, value.n) }
		case 'geopoint':
			return { geoPointValue: { latitude: value.lat, longitude: value.lng } }
		case 'reference':
			return { referenceValue: documentName(projectId, databaseId, value.v) }
		case 'bytes':
			return { bytesValue: value.v }
		case 'vector':
			return {
				mapValue: {
					fields: {
						__type__: { stringValue: VECTOR_TYPE },
						value: { arrayValue: { values: value.v.map((v) => ({ doubleValue: v })) } }
					}
				}
			}
		case 'array':
			return { arrayValue: { values: value.v.map((v) => toRestValue(v, projectId, databaseId)) } }
		case 'map':
			return { mapValue: { fields: toRestFields(value.v, projectId, databaseId) } }
	}
}

export function toRestFields(
	fields: FsFields,
	projectId: string,
	databaseId: string
): Record<string, RestValue> {
	const out: Record<string, RestValue> = {}
	for (const [key, value] of Object.entries(fields))
		out[key] = toRestValue(value, projectId, databaseId)
	return out
}

function parseDouble(v: number | string): number {
	return typeof v === 'number' ? v : Number(v)
}

/** REST Value -> FsValue. */
export function fromRestValue(value: RestValue): FsValue {
	if ('nullValue' in value) return { t: 'null' }
	if ('booleanValue' in value) return { t: 'boolean', v: value.booleanValue }
	if ('integerValue' in value) return { t: 'number', v: Number(value.integerValue) }
	if ('doubleValue' in value) return { t: 'number', v: parseDouble(value.doubleValue) }
	if ('timestampValue' in value) return { t: 'timestamp', ...isoToTimestamp(value.timestampValue) }
	if ('stringValue' in value) return { t: 'string', v: value.stringValue }
	if ('bytesValue' in value) return { t: 'bytes', v: value.bytesValue }
	if ('referenceValue' in value) return { t: 'reference', v: pathFromName(value.referenceValue) }
	if ('geoPointValue' in value) {
		return {
			t: 'geopoint',
			lat: value.geoPointValue.latitude ?? 0,
			lng: value.geoPointValue.longitude ?? 0
		}
	}
	if ('arrayValue' in value)
		return { t: 'array', v: (value.arrayValue.values ?? []).map(fromRestValue) }
	const fields = value.mapValue.fields ?? {}
	const type = fields.__type__
	if (type && 'stringValue' in type && type.stringValue === VECTOR_TYPE) {
		const inner = fields.value
		const items = inner && 'arrayValue' in inner ? (inner.arrayValue.values ?? []) : []
		return { t: 'vector', v: items.map((item) => (fromRestValue(item) as { v: number }).v) }
	}
	return { t: 'map', v: fromRestFields(fields) }
}

export function fromRestFields(fields: Record<string, RestValue> | undefined): FsFields {
	const out: FsFields = {}
	for (const [key, value] of Object.entries(fields ?? {})) out[key] = fromRestValue(value)
	return out
}

/** REST document -> FsDoc. A document without createTime is "missing" (only has subcollections). */
export function fromRestDocument(doc: RestDocument): FsDoc {
	const path = pathFromName(doc.name)
	return {
		id: path.split('/').at(-1) ?? '',
		path,
		createTime: doc.createTime,
		updateTime: doc.updateTime,
		fields: fromRestFields(doc.fields),
		...(doc.createTime ? {} : { missing: true })
	}
}

/** Quotes a field path segment when it isn't a simple identifier (REST field path syntax). */
export function quoteSegment(segment: string): string {
	if (/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(segment)) return segment
	return `\`${segment.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``
}

export function fieldPathString(segments: string[]): string {
	return segments.map(quoteSegment).join('.')
}
