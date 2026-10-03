import type { Anonymizer } from '../anonymize/anonymizer'
import type { FsDoc, FsFields } from '../types/firestore'
import { isDocumentPath, normalizePath } from '../utils/paths'

/** Where a snapshot reads from: the Admin SDK (local build) or the REST API (browser). */
export interface SnapshotSource {
	/** One page of a collection by id, including missing (data-less) parents. */
	listDocuments(
		collectionPath: string,
		pageSize: number,
		pageToken?: string
	): Promise<{ docs: FsDoc[]; nextPageToken?: string }>
	/** Subcollection ids of a document. */
	listCollections(docPath: string): Promise<string[]>
	getDocument(path: string): Promise<FsDoc | null>
}

export interface CollectOptions {
	/** Collection or document paths. */
	paths: string[]
	recursive: boolean
	maxDocs: number
}

const PAGE_SIZE = 300
/** Missing (data-less) parents cost list calls but no reads; cap them separately. */
const MISSING_PER_DOC = 5
const PEOPLE_FIRST = new Set(['users', 'profiles', 'contacts', 'members', 'clients'])
/** Max list calls in flight for one export (shared across all recursion levels). */
const CONCURRENCY = 16

/** A counting semaphore: `run` waits for a free slot. Only wrap leaf network calls (never recursion). */
export function createLimiter(max: number) {
	let active = 0
	const queue: (() => void)[] = []
	return async function run<T>(task: () => Promise<T>): Promise<T> {
		if (active >= max) await new Promise<void>((resolve) => queue.push(resolve))
		else active++
		try {
			return await task()
		} finally {
			// Hand the slot straight to the next waiter so the limit is never exceeded.
			const next = queue.shift()
			if (next) next()
			else active--
		}
	}
}

/**
 * Reads real documents (optionally with subcollections) up to `maxDocs`.
 * The result stays in memory: callers anonymize it before storing anything.
 */
export async function collectDocuments(
	source: SnapshotSource,
	options: CollectOptions
): Promise<{ docs: FsDoc[]; truncated: boolean }> {
	let budget = options.maxDocs
	let missingBudget = options.maxDocs * MISSING_PER_DOC
	let truncated = false
	const collected: FsDoc[] = []
	const limit = createLimiter(CONCURRENCY)

	function hasBudget(): boolean {
		if (budget > 0 && missingBudget > 0) return true
		truncated = true
		return false
	}

	async function walkSubcollections(docPath: string) {
		if (!options.recursive || !hasBudget()) return
		const subs = await limit(() =>
			hasBudget() ? source.listCollections(docPath) : Promise.resolve([])
		)
		// People first, so their names are learned even if the budget runs out later.
		const ordered = [...subs].sort(
			(a, b) => Number(PEOPLE_FIRST.has(b)) - Number(PEOPLE_FIRST.has(a))
		)
		for (const id of ordered) await walkCollection(`${docPath}/${id}`)
	}

	async function walkCollection(path: string) {
		let pageToken: string | undefined
		do {
			if (!hasBudget()) return
			// Budget is re-checked when the call actually runs: siblings may have used it while queued.
			const page = await limit(() =>
				hasBudget()
					? source.listDocuments(path, Math.min(PAGE_SIZE, budget), pageToken)
					: Promise.resolve({ docs: [], nextPageToken: undefined })
			)
			pageToken = page.nextPageToken
			for (const doc of page.docs) {
				if (doc.missing) {
					missingBudget--
					continue
				}
				if (!hasBudget()) break
				budget--
				collected.push(doc)
			}
			// Missing docs still count as parents: their subcollections are real data.
			await Promise.all(page.docs.map((doc) => walkSubcollections(doc.path)))
		} while (pageToken)
	}

	async function walkDocument(path: string) {
		if (!hasBudget()) return
		const doc = await source.getDocument(path)
		if (doc) {
			budget--
			collected.push(doc)
		}
		await walkSubcollections(path)
	}

	for (const raw of options.paths) {
		const path = normalizePath(raw)
		if (isDocumentPath(path)) await walkDocument(path)
		else await walkCollection(path)
	}
	return { docs: collected, truncated }
}

/** Two-pass anonymization of collected docs, in path order so the same data gives the same snapshot. */
export function anonymizeDocuments(
	docs: FsDoc[],
	anonymizer: Anonymizer
): { path: string; fields: FsFields }[] {
	const sorted = [...docs].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
	for (const doc of sorted) anonymizer.learn(doc.fields, doc.path)
	return sorted.map((doc) => ({
		path: anonymizer.path(doc.path),
		fields: anonymizer.fields(doc.fields, doc.path)
	}))
}
