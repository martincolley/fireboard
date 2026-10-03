<script setup lang="ts">
import '~/assets/landing.css'

useHead({
	title: 'Fireboard: Firestore browser for multi-region projects',
	meta: [
		{
			name: 'description',
			content:
				'Browse and edit Firestore across projects and regional databases. Your data goes straight from Google to your browser, never through our servers.'
		}
	]
})
</script>

<template>
	<div class="landing">
		<LandingNav />
		<main>
			<LandingHero />
			<LandingPrivacy />
			<LandingFeatures />
			<LandingSnapshots />
			<LandingMcp />
			<LandingClosing />
		</main>
		<LandingFooter />
	</div>
</template>
