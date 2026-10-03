import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from '../mcp/server'

/**
 * MCP endpoint (Streamable HTTP, stateless): http://127.0.0.1:4321/mcp
 * Local only, guarded by server/middleware/localOnly.ts like the rest of the API.
 */
export default defineEventHandler(async (event) => {
	const server = createMcpServer()
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	})
	await server.connect(transport)
	return transport.handleRequest(toWebRequest(event))
})
