<script setup lang="ts">
import { NButton, NIcon, NInput, NInputNumber, NSelect, NSwitch, NTooltip } from 'naive-ui'
import { AddOutline, CloseOutline, PlayOutline } from '@vicons/ionicons5'
import type { FsFilterOp } from '#shared/types/firestore'
import type { FilterValueType, TabQuery } from '~/composables/useTabs'

const query = defineModel<TabQuery>({ required: true })
defineProps<{ loading: boolean; count: number | null }>()
const emit = defineEmits<{ run: []; count: [] }>()

const ops: FsFilterOp[] = [
	'==',
	'!=',
	'<',
	'<=',
	'>',
	'>=',
	'array-contains',
	'array-contains-any',
	'in',
	'not-in'
]
const opOptions = ops.map((op) => ({ value: op, label: op }))
const typeOptions: { value: FilterValueType; label: string }[] = [
	{ value: 'auto', label: 'auto' },
	{ value: 'string', label: 'string' },
	{ value: 'number', label: 'number' },
	{ value: 'boolean', label: 'boolean' },
	{ value: 'null', label: 'null' },
	{ value: 'timestamp', label: 'timestamp' },
	{ value: 'reference', label: 'reference' }
]
const dirOptions = [
	{ value: 'asc', label: 'asc' },
	{ value: 'desc', label: 'desc' }
]

function addFilter() {
	query.value.filters.push({ field: '', op: '==', type: 'auto', raw: '' })
}

function addOrder() {
	query.value.orderBy.push({ field: '', dir: 'asc' })
}
</script>

<template>
	<div class="query" @keydown.ctrl.enter="emit('run')" @keydown.meta.enter="emit('run')">
		<div v-for="(filter, i) in query.filters" :key="`f${i}`" class="line">
			<span class="label">where</span>
			<NInput
				v-model:value="filter.field"
				size="small"
				class="mono field"
				placeholder="field.path or __name__" />
			<NSelect v-model:value="filter.op" size="small" :options="opOptions" class="op" />
			<NInput
				v-model:value="filter.raw"
				size="small"
				class="mono grow"
				:placeholder="
					['in', 'not-in', 'array-contains-any'].includes(filter.op) ? 'a, b, c' : 'value'
				" />
			<NSelect v-model:value="filter.type" size="small" :options="typeOptions" class="type" />
			<NButton quaternary size="small" @click="query.filters.splice(i, 1)">
				<NIcon :component="CloseOutline" />
			</NButton>
		</div>
		<div v-for="(order, i) in query.orderBy" :key="`o${i}`" class="line">
			<span class="label">order by</span>
			<NInput
				v-model:value="order.field"
				size="small"
				class="mono field"
				placeholder="field.path" />
			<NSelect v-model:value="order.dir" size="small" :options="dirOptions" class="op" />
			<span class="grow" />
			<NButton quaternary size="small" @click="query.orderBy.splice(i, 1)">
				<NIcon :component="CloseOutline" />
			</NButton>
		</div>
		<div class="line">
			<NButton size="small" quaternary @click="addFilter">
				<template #icon><NIcon :component="AddOutline" /></template>
				Where
			</NButton>
			<NButton size="small" quaternary @click="addOrder">
				<template #icon><NIcon :component="AddOutline" /></template>
				Order by
			</NButton>
			<span class="label">limit</span>
			<NInputNumber v-model:value="query.limit" size="small" :min="1" :max="1000" class="limit" />
			<NTooltip>
				<template #trigger>
					<span class="toggle">
						<NSwitch v-model:value="query.group" size="small" />
						<span class="label">collection group</span>
					</span>
				</template>
				Query every collection with this id, at any depth
			</NTooltip>
			<span class="grow" />
			<NButton size="small" quaternary @click="emit('count')">
				{{ count === null ? 'Count' : `${count.toLocaleString()} docs` }}
			</NButton>
			<NButton size="small" type="primary" :loading="loading" @click="emit('run')">
				<template #icon><NIcon :component="PlayOutline" /></template>
				Run
			</NButton>
		</div>
	</div>
</template>

<style scoped>
.query {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: 8px 12px;
	border-bottom: 1px solid var(--fb-border);
}
.line {
	display: flex;
	align-items: center;
	gap: 8px;
}
.label {
	color: var(--fb-muted);
	font-size: 12px;
	white-space: nowrap;
}
.field {
	width: 240px;
}
.op {
	width: 170px;
}
.type {
	width: 120px;
}
.limit {
	width: 90px;
}
.grow {
	flex: 1;
}
.toggle {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}
</style>
