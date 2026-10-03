type ApiOptions = Parameters<typeof $fetch>[1]

/** $fetch for the local API: adds the CSRF header the server requires for writes. */
export function api<T>(url: string, options: ApiOptions = {}): Promise<T> {
	return $fetch<T>(url, {
		...options,
		headers: { 'x-fireboard': '1', ...(options.headers as Record<string, string>) }
	}) as Promise<T>
}

/** Best human-readable message from an API/Firestore error. */
export function apiErrorMessage(error: unknown): string {
	if (error && typeof error === 'object') {
		const data = (error as { data?: { message?: string } }).data
		if (data?.message) return data.message
		if ('message' in error && typeof error.message === 'string') return error.message
	}
	return String(error)
}
