import { FieldPath, type Firestore, type Query } from 'firebase-admin/firestore'
import type { z } from 'zod'
import type { querySchema } from './fsSchemas'
import { decodeValue } from './fsCodec'
import { requireCollectionPath } from './fsTarget'

type QueryInput = z.infer<typeof querySchema>

/** `__name__` (or `id`) filters/orders by document id, like the console. */
function fieldRef(field: string): string | FieldPath {
	return field === '__name__' ? FieldPath.documentId() : field
}

/** Builds the Admin SDK query (without limit/cursor) from a validated request. */
export function buildQuery(db: Firestore, input: QueryInput): Query {
	let query: Query = input.group
		? db.collectionGroup(input.path)
		: db.collection(requireCollectionPath(input.path))

	for (const filter of input.filters ?? []) {
		let value = decodeValue(filter.value, db)
		// Document id filters against a collection accept a bare id; the SDK wants a full ref.
		if (filter.field === '__name__' && typeof value === 'string' && !input.group) {
			value = db.collection(input.path).doc(value)
		}
		query = query.where(fieldRef(filter.field), filter.op, value)
	}
	for (const order of input.orderBy ?? []) query = query.orderBy(fieldRef(order.field), order.dir)
	return query
}
