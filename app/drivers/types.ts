import type {
	DatabaseList,
	FsDoc,
	FsDocResult,
	FsFields,
	FsQuery,
	FsQueryResult,
	FsValue
} from '#shared/types/firestore'

/**
 * Firestore access for one connection. The local build goes through the
 * Fireboard server (which holds the credentials); the hosted build talks to
 * Firestore directly from the browser with the user's own Google token.
 */
export interface DataDriver {
	listDatabases(): Promise<DatabaseList>
	listCollections(db: string, docPath?: string): Promise<string[]>
	getDocument(db: string, path: string): Promise<FsDocResult>
	/** `cursor` is the last document of the previous page (filtered/ordered queries). */
	runQuery(query: Omit<FsQuery, 'conn'>, cursor?: FsDoc): Promise<FsQueryResult>
	count(query: Omit<FsQuery, 'conn' | 'limit'>): Promise<number>
	setDocument(db: string, path: string, fields: FsFields): Promise<FsDoc>
	createDocument(db: string, collection: string, id: string, fields: FsFields): Promise<FsDoc>
	updateField(db: string, path: string, field: string[], value: FsValue | undefined): Promise<FsDoc>
	deleteDocument(db: string, path: string, recursive: boolean): Promise<void>
}
