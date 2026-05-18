// Base URL of the Next.js web server — used by mobile to call API routes
// For local dev: set EXPO_PUBLIC_WEB_API_URL=http://<your-machine-ip>:5000 in apps/mobile/.env
// For production: set to your deployed URL
export const WEB_API_BASE = process.env.EXPO_PUBLIC_WEB_API_URL ?? 'http://localhost:5000'
