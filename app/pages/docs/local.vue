<script setup lang="ts">
useHead({
	title: 'Run Fireboard locally',
	meta: [
		{
			name: 'description',
			content:
				'Run Fireboard entirely on your own machine, on 127.0.0.1, with a service account or your gcloud login.'
		}
	]
})
</script>

<template>
	<DocsPage
		title="Run Fireboard locally"
		lead="The local build is the same interface, running entirely on your machine. Its small server binds to 127.0.0.1 only, holds the credentials you give it, and is never deployed anywhere.">
		<section>
			<h2>What you need</h2>
			<ul>
				<li>Node.js 22 or newer, and git.</li>
				<li>
					The code, from
					<a href="https://github.com/martincolley/fireboard" rel="noopener">
						github.com/martincolley/fireboard </a
					>. It's source-available under the FSL licence and provided as-is, without support.
				</li>
				<li>
					Either a service account key for your project, or the
					<a href="https://cloud.google.com/sdk/docs/install" rel="noopener">gcloud CLI</a>
					signed in with an account that can read Firestore.
				</li>
			</ul>
		</section>

		<section>
			<h2>1. Install and start</h2>
			<pre class="block">
git clone https://github.com/martincolley/fireboard.git
cd fireboard
npm install
npm run dev</pre>
			<p>
				Open
				<code class="l-code-inline">http://127.0.0.1:4321</code>. Nothing listens beyond your own
				machine.
			</p>
		</section>

		<section>
			<h2>2. Add a connection</h2>
			<p>
				Click
				<strong>+</strong>
				in the sidebar and choose how Fireboard signs in to Google:
			</p>
			<ul>
				<li>
					<strong>Service account file:</strong>
					pick the key's JSON file. Fireboard keeps a copy in
					<code class="l-code-inline">~/.config/fireboard/keys/</code>, readable only by you, and
					fills in the project id.
				</li>
				<li>
					<strong>gcloud login:</strong>
					uses your own Google account. Run this once first:
					<pre class="block">
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID</pre>
				</li>
				<li>
					<strong>Emulator:</strong>
					point it at a local Firestore emulator, for example 127.0.0.1:8080.
				</li>
			</ul>
			<p>
				Every database in the project is found automatically, regional ones included. Turn on
				<strong>Read-only</strong>
				for production: the local server then refuses every write.
			</p>
		</section>

		<section>
			<h2>Where things are stored</h2>
			<ul>
				<li>
					Connections:
					<code class="l-code-inline">~/.config/fireboard/connections.json</code>
					(override with
					<code class="l-code-inline">FIREBOARD_CONFIG</code>).
				</li>
				<li>
					Anonymized snapshots:
					<code class="l-code-inline">~/.config/fireboard/snapshots/</code>.
				</li>
				<li>
					Extra anonymization rules:
					<code class="l-code-inline">~/.config/fireboard/anonymize.json</code>.
				</li>
			</ul>
		</section>

		<section>
			<h2>Claude Code (MCP)</h2>
			<p>
				Full guide, including using it with the hosted app:
				<NuxtLink to="/docs/mcp">Claude &amp; MCP</NuxtLink>.
			</p>
			<p>While the local build is running, add its MCP server once:</p>
			<pre class="block">
claude mcp add --transport http --scope user fireboard http://127.0.0.1:4321/mcp</pre>
			<p>
				To let the hosted app at fireboard.dev share what you're viewing with it, start the local
				build with
				<code class="l-code-inline">
					FIREBOARD_ALLOWED_ORIGINS=https://fireboard.dev npm run dev </code
				>, then turn on
				<em>Share view with local MCP companion</em>
				in the hosted app's account menu.
			</p>
		</section>
	</DocsPage>
</template>
