// Vercel Express entry. `npm run bundle` bundles this file (with @m63/server, @m63/engine, @m63/shared)
// into deploy/index.js, which Vercel's Express preset serves from the output directory.
// The canonical app is createApp() in server/src/app.ts; local dev runs server/src/index.ts (app.listen).
import 'express'; // keeps express an external runtime dependency that Vercel detects and traces
import { createApp } from '@m63/server/app';

export default createApp();
