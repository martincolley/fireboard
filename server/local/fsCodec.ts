import {
	DocumentReference,
	FieldValue,
	GeoPoint,
	Timestamp,
	type DocumentData,
	type DocumentSnapshot,
	type Firestore
} from 'firebase-admin/firestore'
import type { FsDoc, FsFields, FsValue } from '#shared/types/firestore'

interface VectorLike {
	toArray(): number[]
}

function isVector(value: object): value is VectorLike {
	return value.constructor?.name === 'VectorValue' && 'toArray' in value
}

/** Admin SDK value -> lossless JSON-safe FsValue. */
export function encodeValue(value: unknown): FsValue {
	if (value === null || value === undefined) return { t: 'null' }
	if (typeof value === 'boolean') return { t: 'boolean', v: value }
	if (typeof value === 'number') return { t: 'number', v: value }
	if (typeof value === 'string') return { t: 'string', v: value }
	if (value instanceof Timestamp) return { t: 'timestamp', s: value.seconds, n: value.nanoseconds }
	if (value instanceof GeoPoint) return { t: 'geopoint', lat: value.latitude, lng: value.longitude }
	if (value instanceof DocumentReference) return { t: 'reference', v: value.path }
	if (value instanceof Uint8Array) return { t: 'bytes', v: Buffer.from(value).toString('base64') }
	if (Array.isArray(value)) return { t: 'array', v: value.map(encodeValue) }
	if (typeof value === 'object') {
		if (isVector(value)) return { t: 'vector', v: value.toArray() }
		return { t: 'map', v: encodeFields(value as DocumentData) }
	}
	return { t: 'string', v: String(value) }
}

export function encodeFields(data: DocumentData): FsFields {
	const out: FsFields = {}
	for (const [key, value] of Object.entries(data)) out[key] = encodeValue(value)
	return out
}

/** FsValue -> Admin SDK value, ready to write to `db`. */
export function decodeValue(value: FsValue, db: Firestore): unknown {
	switch (value.t) {
		case 'null':
			return null
		case 'boolean':
		case 'number':
		case 'string':
			return value.v
		case 'timestamp':
			return new Timestamp(value.s, value.n)
		case 'geopoint':
			return new GeoPoint(value.lat, value.lng)
		case 'reference':
			return db.doc(value.v)
		case 'bytes':
			return Buffer.from(value.v, 'base64')
		case 'vector':
			return FieldValue.vector(value.v)
		case 'array':
			return value.v.map((item) => decodeValue(item, db))
		case 'map':
			return decodeFields(value.v, db)
	}
}

export function decodeFields(fields: FsFields, db: Firestore): DocumentData {
	const out: DocumentData = {}
	for (const [key, value] of Object.entries(fields)) out[key] = decodeValue(value, db)
	return out
}

export function encodeSnapshot(snap: DocumentSnapshot): FsDoc {
	return {
		id: snap.id,
		path: snap.ref.path,
		createTime: snap.createTime?.toDate().toISOString(),
		updateTime: snap.updateTime?.toDate().toISOString(),
		fields: encodeFields(snap.data() ?? {})
	}
}
