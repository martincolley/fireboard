<script setup lang="ts">
import { NIcon } from 'naive-ui'
import {
	AddOutline,
	ChevronDownOutline,
	ChevronForwardOutline,
	CreateOutline,
	TrashOutline
} from '@vicons/ionicons5'
import type { FsValue } from '#shared/types/firestore'
import type { ValuePath } from '~/utils/fsValueEdit'

const props = defineProps<{
	name: string | number
	value: FsValue
	path: ValuePath
	depth: number
}>()

const editor = useFieldEditor()
const expanded = ref(false)
const container = computed(() => isContainer(props.value))

const children = computed<[string | number, FsValue][]>(() => {
	if (props.value.t === 'map') return sortedEntries(props.value.v)
	if (props.value.t === 'array') return props.value.v.map((item, index) => [index, item])
	return []
})

function onValueClick() {
	if (props.value.t === 'reference') editor.openPath(props.value.v)
	else if (container.value) expanded.value = !expanded.value
}
</script>

<template>
	<div
		class="row"
		:style="{ paddingLeft: `${depth * 16 + 8}px` }"
		@dblclick="editor.editable.value && editor.edit(path, value)">
		<span class="key">
			<button v-if="container" class="caret" @click="expanded = !expanded">
				<NIcon :component="expanded ? ChevronDownOutline : ChevronForwardOutline" :size="12" />
			</button>
			<span v-else class="caret-spacer" />
			<span :class="typeof name === 'number' ? 'index' : ''">{{ name }}</span>
		</span>
		<span class="val" :class="{ link: value.t === 'reference' }" @click="onValueClick">
			<ValueInline :value="value" />
		</span>
		<span class="type">{{ TYPE_LABELS[value.t] }}</span>
		<span v-if="editor.editable.value" class="actions">
			<button v-if="container" title="Add" @click="editor.addChild(path, value)">
				<NIcon :component="AddOutline" :size="13" />
			</button>
			<button title="Edit" @click="editor.edit(path, value)">
				<NIcon :component="CreateOutline" :size="13" />
			</button>
			<button title="Delete" @click="editor.remove(path)">
				<NIcon :component="TrashOutline" :size="13" />
			</button>
		</span>
	</div>
	<template v-if="expanded">
		<FieldRow
			v-for="[childName, childValue] in children"
			:key="childName"
			:name="childName"
			:value="childValue"
			:path="[...path, childName]"
			:depth="depth + 1" />
	</template>
</template>

<style scoped>
.row {
	display: grid;
	grid-template-columns: minmax(180px, 30%) 1fr 90px 72px;
	align-items: center;
	min-height: 26px;
	border-bottom: 1px solid var(--fb-border);
	padding-right: 8px;
}
.row:hover {
	background: rgba(255, 255, 255, 0.03);
}
.key {
	display: flex;
	align-items: center;
	gap: 4px;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.index {
	color: var(--fb-muted);
}
.caret,
.actions button {
	background: none;
	border: none;
	color: var(--fb-muted);
	cursor: pointer;
	padding: 2px;
	display: inline-flex;
}
.caret-spacer {
	width: 16px;
	flex: none;
}
.val {
	overflow: hidden;
	min-width: 0;
	display: flex;
}
.val.link {
	cursor: pointer;
	text-decoration: underline dotted;
}
.type {
	color: var(--fb-muted);
	font-size: 11px;
}
.actions {
	display: flex;
	justify-content: flex-end;
	opacity: 0;
}
.row:hover .actions {
	opacity: 1;
}
.actions button:hover {
	color: #fff;
}
</style>
