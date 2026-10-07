import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[M63_SERVER] M63 Intelligence Server listening on port ${env.PORT} (${env.NODE_ENV})`);
  console.log(`[M63_SERVER] Healthcheck available at http://localhost:${env.PORT}/health`);
});
