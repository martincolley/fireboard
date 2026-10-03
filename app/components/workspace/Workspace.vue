<script setup lang="ts">
import { useMessage } from 'naive-ui'

/** The browser itself: sidebar, tabs and the active view. */

const { load } = useConnections()
const { active } = useTabs()
const message = useMessage()
const { isCloud } = useMode()
/** Tabs are restored from storage; render them only once their connections are known. */
const ready = ref(false)
useLiveView()

onMounted(async () => {
	try {
		await load()
	} catch (error) {
		message.error(apiErrorMessage(error))
	} finally {
		ready.value = true
	}
})
</script>

<template>
	<div class="shell">
		<aside class="sidebar">
			<SidebarConnectionSidebar />
		</aside>
		<main class="main">
			<AccountGoogleConnectBanner v-if="isCloud" />
			<BrowserTabBar />
			<BrowserTab v-if="ready && active" :key="active.id" :tab="active" />
			<div v-else class="empty">
				<p>Pick a collection from the sidebar, or add a connection to get started.</p>
			</div>
			<WorkspaceContextMenu />
			<BrowserActionDialog />
		</main>
	</div>
</template>

<style scoped>
.shell {
	display: grid;
	grid-template-columns: 300px 1fr;
	height: 100vh;
}
.sidebar {
	border-right: 1px solid var(--fb-border);
	background: var(--fb-panel);
	overflow: hidden;
	display: flex;
	flex-direction: column;
}
.main {
	display: flex;
	flex-direction: column;
	min-width: 0;
	overflow: hidden;
}
.empty {
	flex: 1;
	display: grid;
	place-items: center;
	color: var(--fb-muted);
}
</style>
