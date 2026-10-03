import type { FsDoc, FsFields, FsValue } from '#shared/types/firestore'
import type { ValuePath } from '~/utils/fsValueEdit'

/** Write operations against the connection + database a tab is pinned to. */
export function useDocWrites(target: { conn: string; db: string }) {
	const driverFor = useDriver()
	const driver = () => driverFor(target.conn)

	function updateField(doc: FsDoc, path: ValuePath, value: FsValue | undefined): Promise<FsDoc> {
		const update = toFieldUpdate(doc.fields, path, value)
		return driver().updateField(target.db, doc.path, update.field, update.value)
	}

	function replaceDoc(path: string, fields: FsFields): Promise<FsDoc> {
		return driver().setDocument(target.db, path, fields)
	}

	function createDoc(collection: string, id: string, fields: FsFields): Promise<FsDoc> {
		return driver().createDocument(target.db, collection, id, fields)
	}

	function deleteDoc(path: string, recursive = false): Promise<void> {
		return driver().deleteDocument(target.db, path, recursive)
	}

	return { updateField, replaceDoc, createDoc, deleteDoc }
}
