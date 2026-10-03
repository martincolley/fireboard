/**
 * Hosted app: one canonical address (PUBLIC_BASE_URL, e.g. https://fireboard.dev).
 * www. redirects there (workers.dev is switched off in wrangler.jsonc, handled
 * here too in case it is re-enabled), so sign-in cookies and Google's
 * registered origins only ever see one host. Local dev hosts are left alone.
 */
export default defineEventHandler((event) => {
	const base = (event.context as { cloudflare?: { env?: { PUBLIC_BASE_URL?: string } } }).cloudflare
		?.env?.PUBLIC_BASE_URL
	if (!base) return
	const canonical = new URL(base)
	const url = getRequestURL(event)
	const isAlias =
		url.hostname.endsWith('.workers.dev') || url.hostname === `www.${canonical.hostname}`
	if (!isAlias || url.hostname === canonical.hostname) return
	return sendRedirect(event, `${canonical.origin}${url.pathname}${url.search}`, 301)
})
