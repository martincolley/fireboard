/**
 * Hosted app: state-changing /api/cloud requests must come from this site.
 * SameSite=Lax cookies already block most cross-site use; this adds depth.
 */
export default defineEventHandler((event) => {
	if (!event.path.startsWith('/api/cloud/') || event.method === 'GET' || event.method === 'HEAD')
		return
	const origin = getRequestHeader(event, 'origin')
	if (!origin || origin !== getRequestURL(event).origin) {
		throw createError({ statusCode: 403, message: 'Cross-origin request blocked' })
	}
})
