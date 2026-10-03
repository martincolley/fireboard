<script setup lang="ts">
import '~/assets/landing.css'

/** Shared layout for the public docs pages (same look as the homepage). */
defineProps<{ title: string; lead: string }>()
</script>

<template>
	<div class="landing">
		<LandingNav />
		<main class="l-container doc">
			<p class="l-eyebrow">Docs</p>
			<h1 class="l-display title">{{ title }}</h1>
			<p class="l-lead">{{ lead }}</p>
			<slot />
			<p class="back"><NuxtLink to="/">← Back to the homepage</NuxtLink></p>
		</main>
		<LandingFooter />
	</div>
</template>

<style scoped>
.doc {
	padding-top: 72px;
	padding-bottom: 96px;
	max-width: 820px;
}
.title {
	font-size: clamp(34px, 5vw, 56px);
}
.doc :deep(section) {
	margin-top: 48px;
}
.doc :deep(h2) {
	font-family: 'Bricolage Grotesque', sans-serif;
	font-size: 26px;
	margin: 0 0 12px;
}
.doc :deep(p),
.doc :deep(li) {
	color: var(--l-soft);
}
.doc :deep(ul),
.doc :deep(ol) {
	padding-left: 20px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.doc :deep(.block) {
	margin: 12px 0;
	padding: 16px;
	background: var(--l-code);
	border: 1px solid var(--l-line);
	border-radius: 10px;
	font-family: 'JetBrains Mono', ui-monospace, monospace;
	font-size: 14px;
	line-height: 1.6;
	white-space: pre-wrap;
	word-break: break-word;
	color: var(--l-text);
}
.doc :deep(.compare) {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	gap: 12px;
}
.back {
	margin-top: 56px;
}
</style>
