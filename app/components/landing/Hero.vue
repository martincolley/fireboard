<template>
	<section id="top" class="l-container hero">
		<div class="pill">Firestore browser · early access</div>
		<h1 class="title">Every Firestore database, every region, one window.</h1>
		<p class="intro">
			Fireboard browses and edits Firestore across projects and regional databases. Your documents
			travel straight from Google to your browser. Our server never sees a single one.
		</p>
		<div class="actions">
			<NuxtLink to="/app" class="l-btn l-btn-primary">Open Fireboard</NuxtLink>
			<a href="#privacy" class="l-btn l-btn-ghost">How your data flows</a>
		</div>
		<figure class="window">
			<div class="chrome" aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</div>
			<img
				src="/landing/table.png"
				width="1440"
				height="640"
				alt="Fireboard showing an orders collection in the default-eu database of a demo project, with typed columns for references, arrays, timestamps and maps" />
			<figcaption>
				Demo data in a local emulator. Orders in the EU database, with references, arrays and
				timestamps shown by type.
			</figcaption>
		</figure>
	</section>
</template>

<style scoped>
.hero {
	padding-top: 88px;
	padding-bottom: 40px;
}
.pill {
	display: inline-flex;
	border: 1px solid var(--l-line-strong);
	border-radius: 999px;
	padding: 6px 14px;
	font-size: 14px;
	color: var(--l-soft);
}
.title {
	font-family: 'Bricolage Grotesque', sans-serif;
	font-weight: 700;
	font-size: clamp(40px, 6vw, 76px);
	line-height: 1.02;
	letter-spacing: -0.03em;
	margin: 24px 0 0;
	max-width: 15ch;
}
.intro {
	font-size: 21px;
	color: var(--l-soft);
	max-width: 46rem;
	margin: 24px 0 0;
}
.actions {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	margin-top: 36px;
}
.window {
	margin: 64px 0 0;
	border: 1px solid #2f2f37;
	border-radius: 14px;
	overflow: hidden;
	background: var(--l-card);
}
.chrome {
	display: flex;
	gap: 8px;
	padding: 12px 16px;
	border-bottom: 1px solid var(--l-line);
}
.chrome span {
	width: 11px;
	height: 11px;
	border-radius: 50%;
	background: var(--l-line-strong);
}
.window img {
	display: block;
	width: 100%;
	height: auto;
}
.window figcaption {
	padding: 12px 16px;
	font-size: 14px;
	color: var(--l-muted);
	border-top: 1px solid var(--l-line);
}
</style>
