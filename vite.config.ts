import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Content Security Policy for the application
// NOTE: This config is ONLY used by the Vite dev server (development).
// Production CSP should be configured at the web server/CDN level.
const isDev = process.env.NODE_ENV !== 'production';

const cspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for dev, remove in production
  "style-src": ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Tailwind
  "img-src": ["'self'", "data:", "https:"],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.dearmp.uk",
    "https://*.kep.la",
    "https://*.farier.com",
    "hk3mkc-5173.csb.app",
    // Development-only: local server connections
    ...(isDev ? [
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://192.168.*:3001", // Local network IPs
    ] : []),
  ],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
};

const cspString = Object.entries(cspDirectives)
  .map(([key, values]) => `${key} ${values.join(" ")}`)
  .join("; ");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ["hk3mkc-5173.csb.app"],
    headers: {
      "Content-Security-Policy": cspString,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    proxy: {
      // Proxy API requests to the local server during development
      '/api/caseworker-proxy': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
