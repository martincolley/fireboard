<script setup lang="ts">
import { NDropdown } from 'naive-ui'

const { state, close } = useContextMenu()

function select(key: string | number) {
	const handler = state.value.onSelect
	close()
	handler(String(key))
}
</script>

<template>
	<NDropdown
		placement="bottom-start"
		trigger="manual"
		size="small"
		:x="state.x"
		:y="state.y"
		:options="state.options"
		:show="state.show"
		@clickoutside="close"
		@select="select" />
</template>
