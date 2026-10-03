/**
 * Two builds from one codebase:
 *
 * - local (default): a local-only tool. Nitro (node-server) holds the user's
 *   credentials, serves the UI on 127.0.0.1, the MCP endpoint and the emulator
 *   snapshot tools. server/middleware/localOnly.ts rejects non-local requests.
 *   Never deploy this build.
 *
 * - cloud (FIREBOARD_MODE=cloud): the hosted app on Cloudflare Workers. The
 *   server only handles app accounts (Better Auth on D1) and billing (Stripe).
 *   Firestore is accessed from the browser with the user's own Google sign-in,
 *   so the server never holds or sees anyone's Google credentials or data.
 */
const mode = process.env.FIREBOARD_MODE === 'cloud' ? 'cloud' : 'local'
const cloud = mode === 'cloud'

/** Server code that only exists in one build (Nitro scan ignore patterns). */
const LOCAL_ONLY = [
	'api/fs/**',
	'api/connections/**',
	'api/snapshots/**',
	'api/view.post.ts',
	'api/events.get.ts',
	'routes/mcp.ts',
	'middleware/localOnly.ts'
]
const CLOUD_ONLY = [
	'api/auth/**',
	'api/cloud/**',
	'middleware/cloudOrigin.ts',
	'middleware/canonicalHost.ts'
]

const GOOGLE_APIS = [
	'https://firestore.googleapis.com',
	'https://cloudresourcemanager.googleapis.com',
	'https://oauth2.googleapis.com',
	'https://www.googleapis.com'
]

export default defineNuxtConfig({
	compatibilityDate: '2026-10-01',
	devtools: { enabled: false },
	ssr: false,
	css: ['~/assets/main.css'],
	modules: cloud ? ['nuxt-security', '@vite-pwa/nuxt'] : [],
	app: {
		head: {
			title: 'Fireboard',
			htmlAttrs: { lang: 'en' },
			link: [{ rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }],
			meta: [{ name: 'theme-color', content: '#18181c' }]
		}
	},
	runtimeConfig: {
		public: {
			mode,
			/** Google OAuth web client id for browser Firestore access (cloud). */
			googleClientId: '',
			/** Local companion (MCP bridge) the hosted UI may talk to. */
			companionUrl: 'http://127.0.0.1:4321'
		}
	},
	build: {
		transpile: ['naive-ui', 'vueuc', '@css-render/vue3-ssr']
	},
	vite: {
		optimizeDeps: {
			include: ['naive-ui', '@vicons/ionicons5']
		}
	},
	nitro: {
		preset: cloud ? 'cloudflare_module' : 'node-server',
		ignore: cloud ? LOCAL_ONLY : CLOUD_ONLY,
		...(cloud
			? {
					cloudflare: { deployConfig: false, nodeCompat: true },
					// Firebase Admin must never be bundled into the hosted worker.
					externals: { external: [] }
				}
			: {})
	},
	...(cloud
		? {
				security: {
					nonce: true,
					rateLimiter: false,
					xssValidator: false,
					headers: {
						crossOriginEmbedderPolicy: false,
						crossOriginOpenerPolicy: 'same-origin-allow-popups',
						contentSecurityPolicy: {
							'default-src': ["'self'"],
							'script-src': [
								"'self'",
								"'nonce-{{nonce}}'",
								"'strict-dynamic'",
								'https://accounts.google.com/gsi/client'
							],
							'script-src-attr': ["'none'"],
							'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
							'connect-src': [
								"'self'",
								...GOOGLE_APIS,
								'https://accounts.google.com',
								'http://127.0.0.1:*',
								'http://localhost:*'
							],
							'frame-src': ['https://accounts.google.com'],
							'img-src': ["'self'", 'data:', 'https://*.googleusercontent.com'],
							'font-src': ["'self'", 'data:'],
							'worker-src': ["'self'"],
							'manifest-src': ["'self'"],
							'object-src': ["'none'"],
							'base-uri': ["'none'"],
							'form-action': [
								"'self'",
								'https://checkout.stripe.com',
								'https://accounts.google.com'
							],
							'frame-ancestors': ["'none'"],
							// Emulators and the local companion are plain http on localhost.
							'upgrade-insecure-requests': false
						},
						permissionsPolicy: {
							camera: [],
							microphone: [],
							geolocation: [],
							'display-capture': [],
							fullscreen: []
						},
						strictTransportSecurity: { maxAge: 31536000, includeSubdomains: true }
					}
				},
				pwa: {
					registerType: 'autoUpdate',
					manifest: {
						name: 'Fireboard',
						short_name: 'Fireboard',
						description: 'Firestore browser for multi-region projects',
						theme_color: '#18181c',
						background_color: '#18181c',
						display: 'standalone',
						icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
					},
					workbox: {
						// The HTML is rendered per request (CSP nonce), so it isn't precached: pages are
						// cached network-first instead, which lets the app open offline after one visit.
						navigateFallback: null,
						globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
						runtimeCaching: [
							{
								urlPattern: ({ request, url }: { request: Request; url: URL }) =>
									request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
								handler: 'NetworkFirst',
								options: { cacheName: 'pages', networkTimeoutSeconds: 4 }
							}
						]
					},
					client: { installPrompt: false }
				}
			}
		: {})
})
