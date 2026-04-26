import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env.PORT ?? 4000);

await app.listen({ host: '127.0.0.1', port });
