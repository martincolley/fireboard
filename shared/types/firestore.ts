/**
 * Lossless, JSON-safe representation of a Firestore value. The server encodes
 * Admin SDK values into this shape and decodes it back before writing, so the
 * UI never loses type information (timestamps, references, geopoints...).
 */
export type FsValue =
	| { t: 'null' }
	| { t: 'boolean'; v: boolean }
	| { t: 'number'; v: number }
	| { t: 'string'; v: string }
	| { t: 'timestamp'; s: number; n: number }
	| { t: 'geopoint'; lat: number; lng: number }
	| { t: 'reference'; v: string }
	| { t: 'bytes'; v: string }
	| { t: 'vector'; v: number[] }
	| { t: 'array'; v: FsValue[] }
	| { t: 'map'; v: Record<string, FsValue> }

export type FsType = FsValue['t']

export type FsFields = Record<string, FsValue>

export interface FsDoc {
	id: string
	path: string
	createTime?: string
	updateTime?: string
	fields: FsFields
	/** No data, but has subcollections (shown in italics, like the console). */
	missing?: boolean
}

export type FsFilterOp =
	| '=='
	| '!='
	| '<'
	| '<='
	| '>'
	| '>='
	| 'array-contains'
	| 'array-contains-any'
	| 'in'
	| 'not-in'

export interface FsFilter {
	field: string
	op: FsFilterOp
	value: FsValue
}

export interface FsOrder {
	field: string
	dir: 'asc' | 'desc'
}

export interface FsQuery {
	conn: string
	db: string
	/** Collection path, or a collection id when `group` is true. */
	path: string
	group?: boolean
	filters?: FsFilter[]
	orderBy?: FsOrder[]
	limit?: number
	/** Full path of the last doc of the previous page (filtered/ordered queries). */
	startAfter?: string
	/** Page token from the previous page (plain browsing, which includes missing docs). */
	pageToken?: string
}

export interface FsQueryResult {
	docs: FsDoc[]
	hasMore: boolean
	nextPageToken?: string
}

export interface FsDocResult {
	doc: FsDoc | null
	collections: string[]
}

export interface DatabaseInfo {
	id: string
	locationId?: string
	type?: string
}

export interface DatabaseList {
	databases: DatabaseInfo[]
	/** Set when discovery failed and the list came from config or the default. */
	warning?: string
}
