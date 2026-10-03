<script setup lang="ts">
import {
	NConfigProvider,
	NDialogProvider,
	NMessageProvider,
	darkTheme,
	type GlobalThemeOverrides
} from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
	common: {
		primaryColor: '#ff8a3d',
		primaryColorHover: '#ff9d5c',
		primaryColorPressed: '#e57324',
		primaryColorSuppl: '#ff8a3d',
		bodyColor: '#18181c',
		cardColor: '#1f1f24',
		modalColor: '#1f1f24',
		popoverColor: '#26262c',
		fontSize: '13px'
	}
}
</script>

<template>
	<NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
		<NMessageProvider>
			<NDialogProvider>
				<NuxtPage />
			</NDialogProvider>
		</NMessageProvider>
	</NConfigProvider>
</template>
