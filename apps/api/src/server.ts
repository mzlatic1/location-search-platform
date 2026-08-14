import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '127.0.0.1';

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'graceful shutdown');
  await app.close();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port, host });
