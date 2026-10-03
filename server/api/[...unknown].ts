/** Unknown API paths answer with a JSON 404 instead of falling through to the SPA page. */
export default defineEventHandler(() => {
	throw createError({ statusCode: 404, message: 'Not found' })
})
