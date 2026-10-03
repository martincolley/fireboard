<script setup lang="ts">
const extras = [
	{
		title: 'Hidden parents, visible',
		body: 'Documents that only hold subcollections are listed in italics, so a regional database never looks empty.'
	},
	{
		title: 'Read-only connections',
		body: 'Mark production read-only and colour-code it, so you always know where you are.'
	},
	{
		title: 'Emulator connections',
		body: 'Point Fireboard at a local Firestore emulator and use it exactly like a real project.'
	},
	{
		title: 'Works offline',
		body: 'Install it as an app. It opens without a connection and keeps working against your emulator.'
	}
]
</script>

<template>
	<section id="features" class="l-container l-section">
		<p class="l-eyebrow">What it does</p>
		<h2 class="l-display l-h2 heading">Built for projects that live in more than one region.</h2>

		<div class="l-row block">
			<div class="l-row-text">
				<h3 class="l-h3">Regions side by side</h3>
				<p class="l-soft">
					Every named database in a project shows up with its location. Switch the same path between
					<code class="l-code-inline">(default)</code>,
					<code class="l-code-inline">default-eu</code>
					and
					<code class="l-code-inline">default-au</code>
					in one click, and keep one tab per database open.
				</p>
			</div>
			<figure class="l-shot l-row-media">
				<img
					src="/landing/switcher.png"
					width="1440"
					height="640"
					loading="lazy"
					alt="The database switcher open on an orders tab, listing (default), default-eu and default-au" />
			</figure>
		</div>

		<div class="l-row block reverse">
			<figure class="l-shot l-row-media">
				<img
					src="/landing/tree.png"
					width="1440"
					height="640"
					loading="lazy"
					alt="A single order document in tree view, with string, reference, array, map, timestamp and number fields" />
			</figure>
			<div class="l-row-text">
				<h3 class="l-h3">Every type, edited in place</h3>
				<p class="l-soft">
					Timestamps keep their nanoseconds, references stay references, geopoints stay geopoints.
					Edit any field, however deeply nested, or the whole document as JSON. References open the
					document they point to.
				</p>
			</div>
		</div>

		<div class="l-row block">
			<div class="l-row-text">
				<h3 class="l-h3">Queries that behave like your code</h3>
				<p class="l-soft">
					Where, order by, limit, collection groups, document-id filters, counts and paging, with
					the same ordering rules as the Firestore SDKs. Index errors come back in full, link
					included.
				</p>
			</div>
			<figure class="l-shot l-row-media">
				<img
					src="/landing/query.png"
					width="1440"
					height="640"
					loading="lazy"
					alt="A customers query filtered on tier equals gold and ordered by lifetimeValue, returning two documents" />
			</figure>
		</div>

		<div class="l-grid extras">
			<div v-for="extra in extras" :key="extra.title" class="l-card">
				<h4>{{ extra.title }}</h4>
				<p>{{ extra.body }}</p>
			</div>
		</div>
	</section>
</template>

<style scoped>
.heading {
	max-width: 22ch;
}
.block {
	margin-top: 96px;
}
.block:first-of-type {
	margin-top: 72px;
}
.reverse {
	flex-wrap: wrap-reverse;
}
.extras {
	margin-top: 96px;
}
.extras h4 {
	margin: 0;
	font-size: 17px;
}
.extras p {
	margin: 8px 0 0;
	color: var(--l-muted);
	font-size: 15px;
}
</style>
