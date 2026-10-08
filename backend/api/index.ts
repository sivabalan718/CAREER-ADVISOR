// Vercel serverless entry: exports the canonical Express app (no app.listen here).
// Local development keeps using server/src/index.ts, which calls app.listen.
import { createApp } from '../server/src/app.js';

export default createApp();
