import type { FsDoc, FsFields, FsValue } from '#shared/types/firestore'
import type { DataDriver } from '~/drivers/types'

export interface DocLocation {
	driver: DataDriver
	db: string
	path: string
}

const PAGE = 300

/** Every document of a collection (including data-less parents), page by page. */
export async function listAllDocuments(driver: DataDriver, db: string, path: string, max = 10_000) {
	const docs: FsDoc[] = []
	let pageToken: string | undefined
	do {
		const page = await driver.runQuery({ db, path, limit: PAGE, pageToken })
		docs.push(...page.docs)
		pageToken = page.nextPageToken
	} while (pageToken && docs.length < max)
	return docs
}

/**
 * Copies a document (and, when `recursive`, every subcollection under it) to
 * another location, possibly another database or project. Not atomic: a
 * failure part-way leaves a partial copy. References inside fields keep
 * pointing at their original paths. Returns how many documents were written.
 */
export async function copyDocumentTree(
	from: DocLocation,
	to: DocLocation,
	recursive: boolean
): Promise<number> {
	const { doc, collections } = await from.driver.getDocument(from.db, from.path)
	let written = 0
	if (doc) {
		await to.driver.setDocument(to.db, to.path, doc.fields)
		written++
	}
	if (!recursive) return written
	for (const sub of collections) {
		for (const child of await listAllDocuments(from.driver, from.db, `${from.path}/${sub}`)) {
			written += await copyDocumentTree(
				{ ...from, path: child.path },
				{ ...to, path: `${to.path}/${sub}/${child.id}` },
				true
			)
		}
	}
	return written
}

/** Every geopoint in a document, with the dotted path to it. */
export function findGeopoints(fields: FsFields): { field: string; lat: number; lng: number }[] {
	const found: { field: string; lat: number; lng: number }[] = []
	const visit = (value: FsValue, path: string) => {
		if (value.t === 'geopoint') found.push({ field: path, lat: value.lat, lng: value.lng })
		else if (value.t === 'map')
			for (const [k, v] of Object.entries(value.v)) visit(v, path ? `${path}.${k}` : k)
		else if (value.t === 'array') value.v.forEach((v, i) => visit(v, `${path}[${i}]`))
	}
	visit({ t: 'map', v: fields }, '')
	return found
}

/** Firebase console link for a document or collection path. */
export function consoleUrl(projectId: string, db: string, path: string): string {
	const database = db === '(default)' ? '-default-' : encodeURIComponent(db)
	const data = path
		.split('/')
		.filter(Boolean)
		.map((segment) => `~2F${encodeURIComponent(segment)}`)
		.join('')
	return `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/firestore/databases/${database}/data/${data}`
}

/** Saves text as a file download. */
export function downloadText(name: string, text: string, type = 'application/json') {
	const url = URL.createObjectURL(new Blob([text], { type }))
	const link = document.createElement('a')
	link.href = url
	link.download = name
	link.click()
	setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
