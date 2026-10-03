/** Which build is running: the local tool or the hosted app. */
export function useMode() {
	const mode = useRuntimeConfig().public.mode as 'local' | 'cloud'
	return { mode, isCloud: mode === 'cloud', isLocal: mode === 'local' }
}
