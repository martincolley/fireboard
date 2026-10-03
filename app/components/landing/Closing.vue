<template>
	<section class="l-container closing">
		<div class="panel">
			<div class="text">
				<h2 class="l-display heading">Prefer to keep everything on your machine?</h2>
				<p class="l-soft">
					Fireboard also runs entirely locally, on 127.0.0.1, with a service account or your gcloud
					login. The code is public, so you can read exactly what it does before you run it.
				</p>
			</div>
			<div class="actions">
				<NuxtLink to="/docs/local" class="l-btn l-btn-primary">Local setup guide</NuxtLink>
				<a
					href="https://github.com/martincolley/fireboard"
					class="l-btn l-btn-ghost"
					rel="noopener">
					Read the code
				</a>
			</div>
		</div>
	</section>
</template>

<style scoped>
.closing {
	padding-top: 104px;
	padding-bottom: 96px;
}
.panel {
	background: var(--l-card);
	border: 1px solid #2f2f37;
	border-radius: 18px;
	padding: 48px 40px;
	display: flex;
	flex-wrap: wrap;
	gap: 28px 48px;
	align-items: center;
}
.text {
	flex: 1 1 420px;
	min-width: 0;
}
.heading {
	font-size: clamp(28px, 3.2vw, 40px);
	margin: 0;
}
.text p {
	margin: 14px 0 0;
}
.actions {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
}
</style>
