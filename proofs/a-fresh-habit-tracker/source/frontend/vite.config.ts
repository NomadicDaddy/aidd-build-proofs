import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const configDir = dirname(fileURLToPath(import.meta.url));

// Dev server ports mirror config/example.json (frontend 3330, backend 3331).
const FRONTEND_PORT = 3330;
const BACKEND_PORT = 3331;

// https://vite.dev/config/
// eslint-disable-next-line import/no-default-export
export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: ['babel-plugin-react-compiler'],
			},
		}),
		tailwindcss(),
	],
	// Pre-bundle `sonner` in the same optimize pass as React so it links against
	// the same optimized React instance. Without this, Vite discovers `sonner`
	// lazily and re-optimizes it in a second pass, leaving it bound to a stale
	// React chunk — which surfaces as a `useState` null error from <Toaster>.
	optimizeDeps: {
		include: ['react', 'react-dom', 'sonner'],
	},
	resolve: {
		alias: {
			'@': resolve(configDir, './src'),
		},
		dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
	},
	server: {
		port: FRONTEND_PORT,
		proxy: {
			'/api': {
				changeOrigin: true,
				target: `http://localhost:${BACKEND_PORT}`,
			},
		},
	},
});
