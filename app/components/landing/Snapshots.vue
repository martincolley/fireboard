<template>
	<section id="snapshots" class="l-container l-section">
		<div class="l-row top">
			<div class="text">
				<p class="l-eyebrow">Anonymized snapshots</p>
				<h2 class="l-display l-h2-sm">
					Real data shapes in your emulator, without the real people.
				</h2>
				<p class="l-soft">
					Copy a collection or document, subcollections included. Fireboard swaps names, emails,
					phone numbers, addresses, tax numbers and secrets for stable fakes before anything is
					saved, then loads the copy into your emulator.
				</p>
				<ul class="l-soft list">
					<li>
						The same person becomes the same fake everywhere, so links between documents still work.
					</li>
					<li>
						Field names, ids, enums, dates and amounts are kept, so your app behaves as it does in
						production.
					</li>
					<li>
						In the browser, snapshots are built and stored on your device. Download one as a file to
						share with a teammate.
					</li>
					<li>Snapshots only ever load into emulators, never into a real project.</li>
				</ul>
			</div>
			<div class="media">
				<figure class="l-shot">
					<img
						src="/landing/snapshot.png"
						width="1440"
						height="640"
						loading="lazy"
						alt="The Anonymized snapshot dialog with a snapshot name, an include subcollections switch and a max documents setting" />
				</figure>
				<div class="compare">
					<div class="l-card example">
						<div class="l-label">Before (illustrative)</div>
						<pre class="l-pre">
displayName: "Jane Citizen"
email: "jane@acme.example"
phone: "+61 400 000 001"
status: "active"</pre>
					</div>
					<div class="l-card example after">
						<div class="l-label">After</div>
						<pre class="l-pre">
displayName: "Riley Hall"
email: "riley.hall.3f2a@example.test"
phone: "+61 827 093 164"
status: "active"</pre>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<style scoped>
.top {
	align-items: flex-start;
}
.text {
	flex: 1 1 360px;
	min-width: 0;
}
.text p {
	margin: 18px 0 0;
}
.list {
	margin: 18px 0 0;
	padding-left: 20px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.media {
	flex: 1 1 420px;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 14px;
}
.compare {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 12px;
}
.example {
	padding: 16px;
	border-radius: 10px;
}
.after {
	border-color: var(--l-accent);
}
</style>
