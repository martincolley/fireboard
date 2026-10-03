import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { FsFilterOp } from '#shared/types/firestore'
import { docToJson, errorResult, jsonResult } from './format'
import { getConnection, loadConnections } from '../local/connectionStore'
import { listDatabases } from '../local/firestoreClients'
import { countQuery, getDocument, listCollectionIds, runQuery } from '../local/fsService'
import { getCurrentView, pushUiCommand } from '../local/liveView'

const MCP_MAX_DOCS = 100

const target = {
	conn: z.string().describe('Connection id (see list_connections)'),
	db: z.string().describe('Database id, e.g. "(default)" or "default-au" (see list_databases)')
}

const EXT_JSON_NOTE =
	'Values use extended JSON: {"__time__": ISO}, {"__ref__": path}, {"__lat__", "__lon__"}, {"__bytes__": base64}.'

/** Wraps a tool body so failures come back as tool errors instead of protocol errors. */
function safe<A>(run: (args: A) => Promise<unknown>) {
	return async (args: A) => {
		try {
			return jsonResult(await run(args))
		} catch (error) {
			return errorResult(error)
		}
	}
}

/** Read-only Firestore tools plus a bridge to what the user has open in the Fireboard UI. */
export function createMcpServer(): McpServer {
	const server = new McpServer({ name: 'fireboard', version: '0.1.0' })

	server.registerTool(
		'get_current_view',
		{
			description:
				'What the user is looking at in Fireboard right now: connection, database, path and query of the active tab, with the current results (documents or the single document). Call this when the user says "this", "what I am looking at" or similar.',
			inputSchema: {}
		},
		safe(async () => {
			const view = getCurrentView()
			if (!view) return { view: null, note: 'Fireboard UI is not open or has no active tab.' }
			// The hosted UI shares the data it shows; the companion has no credentials for it.
			if (view.source === 'cloud' && !view.results) {
				// Never answer a hosted view from local connections that happen to share an id.
				return { view, note: 'The hosted Fireboard tab has not shared its results yet. Try again.' }
			}
			if (view.results) {
				const { results, ...rest } = view
				return {
					view: rest,
					documents: results.documents.map(docToJson),
					hasMore: results.hasMore,
					subcollections: results.subcollections
				}
			}
			if (isDocumentPath(view.path)) {
				const result = await getDocument(view.conn, view.db, view.path)
				return {
					view,
					document: result.doc ? docToJson(result.doc) : null,
					subcollections: result.collections
				}
			}
			const result = await runQuery({
				conn: view.conn,
				db: view.db,
				path: view.path,
				group: view.group,
				filters: view.filters,
				orderBy: view.orderBy,
				limit: Math.min(view.limit, MCP_MAX_DOCS)
			})
			return { view, documents: result.docs.map(docToJson), hasMore: result.hasMore }
		})
	)

	server.registerTool(
		'open_in_fireboard',
		{
			description:
				"Opens a collection or document in the user's Fireboard UI (new tab) so they can see it. Use to show the user something you found.",
			inputSchema: { ...target, path: z.string().describe('Collection or document path') }
		},
		safe(async ({ conn, db, path }: { conn: string; db: string; path: string }) => {
			// Hosted connections aren't in the local config, so the UI validates the id.
			const delivered = await pushUiCommand({ type: 'open', conn, db, path: normalizePath(path) })
			return delivered ? { opened: true } : { opened: false, note: 'No Fireboard UI is open.' }
		})
	)

	server.registerTool(
		'list_connections',
		{ description: 'Lists configured Firebase projects (connections).', inputSchema: {} },
		safe(async () =>
			(await loadConnections()).map((c) => ({
				id: c.id,
				name: c.name,
				projectId: c.projectId,
				readOnly: Boolean(c.readOnly)
			}))
		)
	)

	server.registerTool(
		'list_databases',
		{
			description: "Lists every Firestore database (with region) in a connection's project.",
			inputSchema: { conn: target.conn }
		},
		safe(async ({ conn }: { conn: string }) => listDatabases(await getConnection(conn)))
	)

	server.registerTool(
		'list_collections',
		{
			description:
				'Lists root collections, or the subcollections of a document when `path` is given.',
			inputSchema: { ...target, path: z.string().optional().describe('Document path') }
		},
		safe(async ({ conn, db, path }: { conn: string; db: string; path?: string }) =>
			listCollectionIds(conn, db, path || undefined)
		)
	)

	server.registerTool(
		'get_document',
		{
			description: `Reads one document and lists its subcollections. ${EXT_JSON_NOTE}`,
			inputSchema: {
				...target,
				path: z.string().describe('Document path, e.g. tenant/abc/users/xyz')
			}
		},
		safe(async ({ conn, db, path }: { conn: string; db: string; path: string }) => {
			const result = await getDocument(conn, db, path)
			return {
				document: result.doc ? docToJson(result.doc) : null,
				subcollections: result.collections
			}
		})
	)

	const queryInput = {
		...target,
		path: z.string().describe('Collection path, or a collection id when group is true'),
		group: z
			.boolean()
			.optional()
			.describe('Collection group query across all collections with this id'),
		filters: z
			.array(
				z.object({
					field: z.string().describe('Field path, or __name__ for the document id'),
					op: z.enum([
						'==',
						'!=',
						'<',
						'<=',
						'>',
						'>=',
						'array-contains',
						'array-contains-any',
						'in',
						'not-in'
					]),
					value: z
						.unknown()
						.describe('Extended JSON value; arrays for in / not-in / array-contains-any')
				})
			)
			.optional(),
		orderBy: z.array(z.object({ field: z.string(), dir: z.enum(['asc', 'desc']) })).optional()
	}
	type QueryArgs = {
		conn: string
		db: string
		path: string
		group?: boolean
		filters?: { field: string; op: FsFilterOp; value?: unknown }[]
		orderBy?: { field: string; dir: 'asc' | 'desc' }[]
	}
	const toQuery = (args: QueryArgs) => ({
		conn: args.conn,
		db: args.db,
		path: args.path,
		group: args.group,
		filters: args.filters?.map((f) => ({ field: f.field, op: f.op, value: fromExtJson(f.value) })),
		orderBy: args.orderBy
	})

	server.registerTool(
		'query_collection',
		{
			description: `Queries a collection (or collection group). Without filters/orderBy it lists documents by id, including data-less parents of subcollections. ${EXT_JSON_NOTE}`,
			inputSchema: {
				...queryInput,
				limit: z.number().int().min(1).max(MCP_MAX_DOCS).optional().describe('Default 20'),
				pageToken: z.string().optional().describe('From a previous unfiltered page'),
				startAfter: z.string().optional().describe('Last document path of a previous filtered page')
			}
		},
		safe(async (args: QueryArgs & { limit?: number; pageToken?: string; startAfter?: string }) => {
			const result = await runQuery({
				...toQuery(args),
				limit: args.limit ?? 20,
				pageToken: args.pageToken,
				startAfter: args.startAfter
			})
			return {
				documents: result.docs.map(docToJson),
				hasMore: result.hasMore,
				nextPageToken: result.nextPageToken
			}
		})
	)

	server.registerTool(
		'count_documents',
		{
			description: 'Counts documents matching a query (cheap aggregate).',
			inputSchema: queryInput
		},
		safe(async (args: QueryArgs) => ({ count: await countQuery(toQuery(args)) }))
	)

	return server
}
