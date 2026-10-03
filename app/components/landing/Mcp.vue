<template>
	<section id="mcp" class="l-container l-section">
		<div class="l-row top">
			<div class="text">
				<p class="l-eyebrow">Claude &amp; MCP</p>
				<h2 class="l-display l-h2-sm">Show Claude what you're looking at.</h2>
				<p class="l-soft">
					Run Fireboard locally as a companion and add it to Claude Code. Claude can read the tab
					you have open and open documents for you to see. With projects connected locally, it can
					run its own queries too.
				</p>
				<p class="l-soft">
					Sharing is off until you turn it on, and your view goes from your browser to
					<code class="l-code-inline">127.0.0.1</code>
					only. The MCP runs on your machine, not ours.
				</p>
			</div>
			<div class="media">
				<div class="terminal">
					<div class="l-label">Terminal</div>
					<pre class="l-pre command">
claude mcp add --transport http fireboard http://127.0.0.1:4321/mcp</pre>
				</div>
				<div class="terminal session">
					<div class="l-label">Claude Code (example)</div>
					<div class="l-mono line">
						<span class="you">you ›</span>
						why is this order still unpaid?
					</div>
					<div class="l-mono line tool">● get_current_view</div>
					<div class="l-mono line tool">● query_collection orders/ord_eu_2401/events</div>
					<div class="l-mono line tool">● open_in_fireboard customers/cust_eu_101</div>
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
.media {
	flex: 1 1 420px;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.terminal {
	background: var(--l-code);
	border: 1px solid var(--l-line);
	border-radius: 12px;
	padding: 18px;
}
.command {
	font-size: 14px;
	word-break: break-all;
}
.session {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.line {
	font-size: 14px;
}
.you {
	color: var(--l-muted);
}
.tool {
	color: var(--l-accent);
}
</style>
