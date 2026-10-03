import { createLocalDriver } from '~/drivers/localDriver'
import { createRestDriver } from '~/drivers/restDriver'
import type { DataDriver } from '~/drivers/types'

/** The data driver for a connection id, for whichever build is running. */
export function useDriver() {
	const { isCloud } = useMode()
	const { byId } = useConnections()
	const google = useGoogleAuth()

	return function driverFor(conn: string): DataDriver {
		if (!isCloud) return createLocalDriver(conn)
		const connection = byId(conn)
		if (!connection) throw new Error(`Unknown connection "${conn}"`)
		return createRestDriver(connection, google.getToken)
	}
}
