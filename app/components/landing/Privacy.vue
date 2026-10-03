<script setup lang="ts">
const points = [
	{
		title: 'Straight from Google',
		body: "Fireboard calls Firestore's API from your browser. There is no proxy, cache or copy on our side."
	},
	{
		title: 'Your token stays in the tab',
		body: "The Google access token lives in memory only. It is never written to storage and never sent to us. We don't keep Google tokens from sign-in either."
	},
	{
		title: 'Your permissions, not ours',
		body: "You see exactly what your Google account can see. Fireboard holds no service accounts and no keys to anyone's project."
	},
	{
		title: 'A locked-down page',
		body: "A strict Content Security Policy allows scripts only from Fireboard and Google Sign-In, and connections only to Google's APIs and your own machine."
	}
]
</script>

<template>
	<section id="privacy" class="band">
		<div class="l-container inner">
			<p class="l-eyebrow">Privacy by architecture</p>
			<h2 class="l-display l-h2 heading">Your data never touches our servers.</h2>
			<p class="l-lead">
				Not "encrypted on our servers". Not "deleted after 30 days". Collections, documents, queries
				and edits go between your browser and Google, and nowhere else. Don't take our word for it:
				<a href="https://github.com/martincolley/fireboard" rel="noopener">the code is public</a>.
			</p>
			<LandingDataFlow />
			<div class="points">
				<div v-for="point in points" :key="point.title" class="point">
					<h3>{{ point.title }}</h3>
					<p>{{ point.body }}</p>
				</div>
			</div>
		</div>
	</section>
</template>

<style scoped>
.band {
	background: var(--l-band);
	border-top: 1px solid var(--l-line);
	border-bottom: 1px solid var(--l-line);
	margin-top: 56px;
}
.inner {
	padding-top: 96px;
	padding-bottom: 96px;
}
.heading {
	max-width: 20ch;
}
.points {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	gap: 20px;
	margin-top: 64px;
}
.point {
	border-top: 2px solid var(--l-accent);
	padding-top: 18px;
}
.point h3 {
	margin: 0;
	font-size: 18px;
	font-weight: 600;
}
.point p {
	margin: 8px 0 0;
	color: var(--l-soft);
	font-size: 16px;
}
</style>
