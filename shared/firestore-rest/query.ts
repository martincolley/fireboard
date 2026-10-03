import type { FsDoc, FsFilter, FsOrder, FsQuery } from '../types/firestore'
import { getFieldValue } from '../utils/fieldValue'
import { documentName, documentsRoot, quoteSegment, toRestValue, type RestValue } from './codec'

const OPERATORS: Record<FsFilter['op'], string> = {
	'==': 'EQUAL',
	'!=': 'NOT_EQUAL',
	'<': 'LESS_THAN',
	'<=': 'LESS_THAN_OR_EQUAL',
	'>': 'GREATER_THAN',
	'>=': 'GREATER_THAN_OR_EQUAL',
	'array-contains': 'ARRAY_CONTAINS',
	'array-contains-any': 'ARRAY_CONTAINS_ANY',
	in: 'IN',
	'not-in': 'NOT_IN'
}
const INEQUALITIES = new Set(['!=', '<', '<=', '>', '>=', 'not-in'])
const DOC_ID = '__name__'

/** "a.b" -> "a.b", with segments quoted when needed. `__name__` stays as is. */
function fieldRef(field: string) {
	return { fieldPath: field === DOC_ID ? DOC_ID : field.split('.').map(quoteSegment).join('.') }
}

/** Splits "a/b/c/d/e" into the parent document path ("a/b/c/d") and collection id ("e"). */
export function splitCollectionPath(path: string): { parent: string; collectionId: string } {
	const segments = path.split('/').filter(Boolean)
	return { parent: segments.slice(0, -1).join('/'), collectionId: segments.at(-1) ?? '' }
}

export interface BuiltQuery {
	/** Parent resource for :runQuery (documents root or a document). */
	parent: string
	structuredQuery: Record<string, unknown>
	/** Effective ordering (explicit + implied), used to build cursors. */
	orderBy: FsOrder[]
}

/**
 * Builds a REST structuredQuery equivalent to what the Admin SDK sends:
 * inequality filters imply an order on their field, and `__name__` is always
 * the final order so cursors are unique.
 */
export function buildStructuredQuery(q: FsQuery, projectId: string, cursorDoc?: FsDoc): BuiltQuery {
	const root = documentsRoot(projectId, q.db)
	const { parent, collectionId } = q.group
		? { parent: '', collectionId: q.path }
		: splitCollectionPath(q.path)

	const filters = (q.filters ?? []).map((f) => toRestFilter(f, q, projectId))
	// Same as the SDKs: explicit orders, then inequality fields not already ordered (sorted by
	// name, in the last explicit direction), then __name__.
	const orderBy: FsOrder[] = [...(q.orderBy ?? [])]
	const lastDir = orderBy.at(-1)?.dir ?? 'asc'
	const implied = [
		...new Set(
			(q.filters ?? [])
				.filter((f) => INEQUALITIES.has(f.op) && f.field !== DOC_ID)
				.map((f) => f.field)
				.filter((field) => !orderBy.some((o) => o.field === field))
		)
	].sort()
	orderBy.push(...implied.map((field) => ({ field, dir: lastDir })))
	if (!orderBy.some((o) => o.field === DOC_ID)) {
		orderBy.push({ field: DOC_ID, dir: orderBy.at(-1)?.dir ?? 'asc' })
	}

	const structuredQuery: Record<string, unknown> = {
		from: [{ collectionId, allDescendants: Boolean(q.group) }],
		orderBy: orderBy.map((o) => ({
			field: fieldRef(o.field),
			direction: o.dir === 'desc' ? 'DESCENDING' : 'ASCENDING'
		}))
	}
	if (filters.length === 1) structuredQuery.where = filters[0]
	if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } }
	if (q.limit) structuredQuery.limit = q.limit
	if (cursorDoc) {
		structuredQuery.startAt = {
			before: false,
			values: orderBy.map((o) =>
				o.field === DOC_ID
					? { referenceValue: documentName(projectId, q.db, cursorDoc.path) }
					: toRestValue(getFieldValue(cursorDoc.fields, o.field) ?? { t: 'null' }, projectId, q.db)
			)
		}
	}
	return { parent: parent ? `${root}/${parent}` : root, structuredQuery, orderBy }
}

function toRestFilter(f: FsFilter, q: FsQuery, projectId: string): Record<string, unknown> {
	const field = fieldRef(f.field)
	// Like the SDKs: equality with null/NaN becomes a unary filter.
	if ((f.op === '==' || f.op === '!=') && f.value.t === 'null') {
		return { unaryFilter: { op: f.op === '==' ? 'IS_NULL' : 'IS_NOT_NULL', field } }
	}
	if ((f.op === '==' || f.op === '!=') && f.value.t === 'number' && Number.isNaN(f.value.v)) {
		return { unaryFilter: { op: f.op === '==' ? 'IS_NAN' : 'IS_NOT_NAN', field } }
	}
	let value: RestValue = toRestValue(f.value, projectId, q.db)
	if (f.field === DOC_ID) value = documentIdValue(f, q, projectId)
	return { fieldFilter: { field, op: OPERATORS[f.op], value } }
}

/** Document id filters accept a bare id (relative to the collection) or a full path. */
function documentIdValue(f: FsFilter, q: FsQuery, projectId: string): RestValue {
	const toRef = (raw: string): RestValue => ({
		referenceValue: documentName(
			projectId,
			q.db,
			raw.includes('/') || q.group ? raw : `${q.path}/${raw}`
		)
	})
	if (f.value.t === 'string') return toRef(f.value.v)
	if (f.value.t === 'array') {
		return {
			arrayValue: {
				values: f.value.v.map((v) =>
					v.t === 'string' ? toRef(v.v) : toRestValue(v, projectId, q.db)
				)
			}
		}
	}
	return toRestValue(f.value, projectId, q.db)
}
