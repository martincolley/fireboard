<template>
	<header class="bar">
		<nav class="l-container nav" aria-label="Main">
			<NuxtLink to="/" class="brand">
				<LandingLogo />
				<span>Fireboard</span>
			</NuxtLink>
			<div class="links">
				<a href="/#privacy">Privacy</a>
				<a href="/#features">Features</a>
				<a href="/#snapshots">Snapshots</a>
				<a href="/#mcp">Claude &amp; MCP</a>
				<NuxtLink to="/docs/local">Run locally</NuxtLink>
				<a href="https://github.com/martincolley/fireboard" rel="noopener">Code</a>
			</div>
			<NuxtLink to="/app" class="l-btn l-btn-primary open">Open Fireboard</NuxtLink>
		</nav>
	</header>
</template>

<style scoped>
.bar {
	border-bottom: 1px solid var(--l-line);
}
.nav {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 12px 28px;
	padding-top: 18px;
	padding-bottom: 18px;
}
.brand {
	display: flex;
	align-items: center;
	gap: 10px;
	text-decoration: none;
	color: var(--l-text);
	font-family: 'Bricolage Grotesque', sans-serif;
	font-weight: 700;
	font-size: 20px;
}
.links {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 22px;
	flex: 1 1 auto;
	font-size: 15px;
}
.landing .links a {
	color: var(--l-soft);
	text-decoration: none;
	padding: 10px 0;
}
.landing .links a:hover {
	color: var(--l-text);
}
.open {
	min-height: 44px;
	padding: 10px 18px;
	font-size: 15px;
	border-radius: 8px;
}
</style>
