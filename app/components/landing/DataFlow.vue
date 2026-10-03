<template>
	<div
		class="flow"
		role="img"
		aria-label="Documents, queries and edits travel directly between your browser and Google Firestore. Fireboard's server only serves the app and your sign-in.">
		<div class="row">
			<div class="node">
				<div class="name">Your browser</div>
				<div class="desc">Runs Fireboard. Holds your Google token in memory for about an hour.</div>
			</div>
			<div class="link">
				<div class="l-mono what">documents · queries · edits</div>
				<div class="wire"></div>
				<div class="how">direct, over HTTPS</div>
			</div>
			<div class="node google">
				<div class="name">Google Firestore</div>
				<div class="desc">
					Answers with your own Google permissions, as it would for the console.
				</div>
			</div>
		</div>
		<div class="row">
			<div class="link down">
				<div class="dash"></div>
				<div class="how">the app itself, and who you are</div>
			</div>
			<div class="spacer"></div>
		</div>
		<div class="row">
			<div class="node server">
				<div class="name">Fireboard's server</div>
				<div class="desc">
					Serves the page and your sign-in. Stores your email and the project ids you add. Never a
					document.
				</div>
			</div>
			<div class="spacer"></div>
		</div>
	</div>
</template>

<style scoped>
.flow {
	display: flex;
	flex-direction: column;
	gap: 18px;
	margin-top: 56px;
	max-width: 980px;
}
.row {
	display: flex;
	flex-wrap: wrap;
	align-items: stretch;
	gap: 14px;
}
.node {
	flex: 1 1 220px;
	border: 1px solid var(--l-line-strong);
	border-radius: 12px;
	padding: 20px;
	background: #1f1f25;
}
.node.google {
	border-color: var(--l-accent);
	background: #221a15;
}
.node.server {
	border-style: dashed;
	border-color: #5a5a66;
	background: transparent;
}
.name {
	font-weight: 600;
}
.desc {
	font-size: 15px;
	color: var(--l-muted);
	margin-top: 4px;
}
.link {
	flex: 1 1 220px;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	gap: 6px;
	padding: 8px;
	text-align: center;
}
.what {
	font-size: 13px;
	color: var(--l-accent);
}
.wire {
	width: 100%;
	height: 2px;
	background: var(--l-accent);
}
.how {
	font-size: 13px;
	color: var(--l-muted);
}
.dash {
	height: 28px;
	border-left: 2px dashed #5a5a66;
}
.spacer {
	flex: 2 1 460px;
}
</style>
