<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { CloseOutline } from '@vicons/ionicons5'

const { tabs, activeId, activate, close } = useTabs()
const { byId } = useConnections()

function label(path: string): string {
	return path || '/'
}
</script>

<template>
	<div class="tabbar">
		<div
			v-for="tab in tabs"
			:key="tab.id"
			class="tab"
			:class="{ active: tab.id === activeId }"
			:title="`${byId(tab.conn)?.name ?? tab.conn} · ${tab.db} · ${tab.path}`"
			@click="activate(tab.id)"
			@auxclick.prevent="close(tab.id)">
			<span class="dot" :style="{ background: byId(tab.conn)?.color || 'var(--fb-accent)' }" />
			<span class="db">{{ tab.db }}</span>
			<span class="path">{{ label(tab.path) }}</span>
			<button class="close" @click.stop="close(tab.id)">
				<NIcon :component="CloseOutline" :size="12" />
			</button>
		</div>
	</div>
</template>

<style scoped>
.tabbar {
	display: flex;
	overflow-x: auto;
	border-bottom: 1px solid var(--fb-border);
	background: var(--fb-panel);
	min-height: 36px;
}
.tab {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 0 8px 0 12px;
	border-right: 1px solid var(--fb-border);
	cursor: pointer;
	white-space: nowrap;
	color: var(--fb-muted);
	max-width: 320px;
}
.tab.active {
	background: var(--fb-bg);
	color: #fff;
	box-shadow: inset 0 -2px 0 var(--fb-accent);
}
.dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex: none;
}
.db {
	font-size: 11px;
	opacity: 0.7;
}
.path {
	overflow: hidden;
	text-overflow: ellipsis;
}
.close {
	background: none;
	border: none;
	color: inherit;
	cursor: pointer;
	padding: 2px;
	display: flex;
	opacity: 0.6;
}
.close:hover {
	opacity: 1;
}
</style>
