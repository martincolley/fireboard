/**
 * Fireboard holds live database credentials, so the API must only answer the
 * local UI. Blocks:
 * - DNS rebinding (a remote site resolving its own hostname to 127.0.0.1): Host must be loopback.
 * - Cross-site requests from other tabs: Origin, when sent, must match Host.
 * - Simple-request CSRF: API writes need a custom header, which forces a CORS preflight we never approve.
 *   /mcp is exempt (MCP clients can't add it) and exposes read-only tools only.
 *
 * Companion mode: origins listed in FIREBOARD_ALLOWED_ORIGINS (the hosted app; https, or
 * http on localhost for testing)
 * may call only the live-view bridge (POST /api/view, GET /api/events), so the
 * hosted UI can share what it shows with a local MCP client. Nothing else.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
/** Host of an Origin header; "null" or malformed origins never match. */
function originHost(origin: string): string | null {
	try {
		return new URL(origin).host
	} catch {
		return null
	}
}

const BRIDGE_PATHS = new Set(['/api/view', '/api/events'])

function allowedOrigins(): Set<string> {
	return new Set(
		(process.env.FIREBOARD_ALLOWED_ORIGINS ?? '')
			.split(',')
			.map((o) => o.trim().replace(/\/$/, ''))
			.filter((o) => /^https:\/\/[^/]+$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))
	)
}

export default defineEventHandler((event) => {
	const isApi = event.path.startsWith('/api/')
	const isMcp = event.path === '/mcp' || event.path.startsWith('/mcp?')
	if (!isApi && !isMcp) return

	const host = getRequestHeader(event, 'host') ?? ''
	const hostname = host.replace(/:\d+$/, '')
	if (!LOOPBACK_HOSTS.has(hostname)) {
		throw createError({ statusCode: 403, message: 'Fireboard only serves localhost' })
	}

	const origin = getRequestHeader(event, 'origin')
	if (origin && originHost(origin) !== host) {
		const bridge = BRIDGE_PATHS.has(event.path.split('?')[0]!) && allowedOrigins().has(origin)
		if (!bridge) throw createError({ statusCode: 403, message: 'Cross-origin request blocked' })
		setResponseHeaders(event, {
			'Access-Control-Allow-Origin': origin,
			'Access-Control-Allow-Methods': 'GET, POST',
			'Access-Control-Allow-Headers': 'content-type, x-fireboard',
			// Chrome's Private Network Access: a public site may reach this loopback server.
			'Access-Control-Allow-Private-Network': 'true',
			Vary: 'Origin'
		})
		if (event.method === 'OPTIONS') {
			setResponseStatus(event, 204)
			return ''
		}
	}

	// MCP clients can't send our header; the Origin check above covers browser CSRF for /mcp.
	if (isApi && event.method !== 'GET' && getRequestHeader(event, 'x-fireboard') !== '1') {
		throw createError({ statusCode: 403, message: 'Missing x-fireboard header' })
	}
})
