// Vercel serverless entry: exports the existing Express app (no app.listen here).
// Local development keeps using server/src/index.ts, which calls app.listen.
import { createApp } from '@m63/server/dist/app.js';

export default createApp();
