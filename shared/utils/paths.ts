/** Splits a Firestore path into segments, ignoring leading/trailing/double slashes. */
export function pathSegments(path: string): string[] {
	return path.split('/').filter(Boolean)
}

export function normalizePath(path: string): string {
	return pathSegments(path).join('/')
}

/** Collection paths have an odd number of segments, document paths an even (non-zero) number. */
export function isCollectionPath(path: string): boolean {
	return pathSegments(path).length % 2 === 1
}

export function isDocumentPath(path: string): boolean {
	const len = pathSegments(path).length
	return len > 0 && len % 2 === 0
}

export function parentPath(path: string): string {
	return pathSegments(path).slice(0, -1).join('/')
}

export function lastSegment(path: string): string {
	return pathSegments(path).at(-1) ?? ''
}
