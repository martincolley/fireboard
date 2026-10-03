export type ConnectionCredential =
	| { type: 'serviceAccount'; path: string }
	| { type: 'adc' }
	/** Hosted app only: the signed-in user's Google account, in their browser. */
	| { type: 'google' }
	/** Local Firestore emulator, e.g. host "127.0.0.1:8080". No Google credentials involved. */
	| { type: 'emulator'; host: string }

export interface Connection {
	id: string
	name: string
	projectId: string
	credential: ConnectionCredential
	/** Explicit database ids. When omitted, databases are discovered from the project. */
	databases?: string[]
	/** Blocks every write for this connection on the server. */
	readOnly?: boolean
	/** Accent color so production vs test is obvious at a glance. */
	color?: string
}
