<script setup lang="ts">
useHead({
	title: 'Claude & MCP',
	meta: [
		{
			name: 'description',
			content:
				'Let Claude Code see what you have open in Fireboard and open documents for you, with your data staying on your machine.'
		}
	]
})
</script>

<template>
	<DocsPage
		title="Claude & MCP"
		lead="Fireboard's MCP server lets Claude Code see what you have open, open documents for you and, with local connections, run its own queries. It always runs on your machine: fireboard.dev has no MCP endpoint, so your data never passes through our servers on its way to Claude.">
		<section>
			<h2>Two ways to use it</h2>
			<div class="compare">
				<div class="l-card">
					<h3 class="card-title">Local build</h3>
					<p>Run Fireboard locally with your own connections. Claude can do everything below.</p>
				</div>
				<div class="l-card">
					<h3 class="card-title">fireboard.dev + local companion</h3>
					<p>
						Keep using the hosted app. A local copy of Fireboard runs alongside it and receives what
						your tab shows, so Claude sees exactly what you see.
					</p>
				</div>
			</div>
		</section>

		<section>
			<h2>1. Start Fireboard locally</h2>
			<p>
				Follow the
				<NuxtLink to="/docs/local">local setup guide</NuxtLink>. If you'll use it as a companion for
				fireboard.dev, start it with the hosted address allowed:
			</p>
			<pre class="block">FIREBOARD_ALLOWED_ORIGINS=https://fireboard.dev npm run dev</pre>
			<p>
				That lets fireboard.dev reach only two things on your machine: the endpoint that receives
				your current view, and the one that lets Claude open tabs. Everything else stays local-only.
			</p>
		</section>

		<section>
			<h2>2. Add it to Claude Code</h2>
			<pre class="block">
claude mcp add --transport http --scope user fireboard http://127.0.0.1:4321/mcp</pre>
			<p>Run this once. Claude Code connects whenever Fireboard is running.</p>
		</section>

		<section>
			<h2>3. Using fireboard.dev? Turn on sharing</h2>
			<p>
				In the hosted app, open the account menu (the person icon at the top of the sidebar) and
				choose
				<strong>Share view with local MCP companion</strong>. It stays off until you do this, and
				your view only ever goes from your browser to <code class="l-code-inline">127.0.0.1</code>.
			</p>
		</section>

		<section>
			<h2>What Claude can do</h2>
			<ul>
				<li>
					<strong>get_current_view</strong>: the connection, database, path and query of your active
					tab, with the documents it shows.
				</li>
				<li>
					<strong>open_in_fireboard</strong>: opens a collection or document in a new tab, to show
					you something it found.
				</li>
				<li>
					<strong>
						list_connections, list_databases, list_collections, get_document, query_collection,
						count_documents </strong
					>: read and query directly. These work with connections set up in the local build, because
					the hosted app's Google sign-in never leaves your browser.
				</li>
			</ul>
			<p>Every tool is read-only: Claude can't change your data through Fireboard.</p>
		</section>

		<section>
			<h2>Try it</h2>
			<p>Open a document in Fireboard, then ask Claude Code something like:</p>
			<pre class="block">
why is this order still unpaid?
which customers in the EU database have the gold tier?
open the user that created this invoice</pre>
		</section>
	</DocsPage>
</template>

<style scoped>
.card-title {
	margin: 0;
	font-size: 18px;
}
</style>
