import type { InjectionKey } from 'vue'
import type { FsValue } from '#shared/types/firestore'
import type { ValuePath } from '~/utils/fsValueEdit'

/** Actions a FieldRow (at any depth) can ask its owning DocFields to perform. */
export interface FieldEditorContext {
	editable: Ref<boolean>
	edit(path: ValuePath, value: FsValue): void
	addChild(path: ValuePath, container: FsValue): void
	remove(path: ValuePath): void
	openPath(path: string): void
}

export const fieldEditorKey: InjectionKey<FieldEditorContext> = Symbol('field-editor')

export function useFieldEditor(): FieldEditorContext {
	const context = inject(fieldEditorKey)
	if (!context) throw new Error('FieldRow must be rendered inside DocFields')
	return context
}
