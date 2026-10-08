// Vercel Express entrypoint (backend/ root). The canonical app is built by @m63/server;
// local development still runs server/src/index.ts, which calls app.listen.
import 'express'; // Vercel's Express preset detects the entry by its express import
import { createApp } from '@m63/server/app';

export default createApp();
