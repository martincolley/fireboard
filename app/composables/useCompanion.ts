const STORAGE_KEY = 'fireboard:companion'

/**
 * Hosted app only, opt-in: share what you're looking at with a Fireboard
 * companion running on your own machine (for Claude Code / MCP). The data goes
 * from your browser to 127.0.0.1, never to Fireboard's servers.
 */
export function useCompanion() {
	const url = (useRuntimeConfig().public.companionUrl as string).replace(/\/$/, '')
	const enabled = useState('companion-enabled', () => {
		try {
			return localStorage.getItem(STORAGE_KEY) === '1'
		} catch {
			return false
		}
	})

	function setEnabled(value: boolean) {
		enabled.value = value
		try {
			localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
		} catch {
			// Non-essential.
		}
	}

	return { url, enabled, setEnabled }
}
