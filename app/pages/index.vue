<script setup lang="ts">
/** Hosted build: the public homepage (the app lives at /app). Local build: the app itself. */
const { isCloud } = useMode()
</script>

<template>
	<LandingPage v-if="isCloud" />
	<AppRoot v-else />
</template>
