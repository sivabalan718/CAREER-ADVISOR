// Vercel function entry, bundled by scripts/build-vercel-output.mjs. The canonical app is built by
// @m63/server; local development still runs server/src/index.ts, which calls app.listen.
import { createApp } from '@m63/server/app';

export default createApp();
