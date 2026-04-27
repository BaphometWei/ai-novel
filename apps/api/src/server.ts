import { createPersistentApiRuntime } from './runtime';

const runtime = await createPersistentApiRuntime();
const port = Number(process.env.PORT ?? 4000);

await runtime.app.listen({ host: '127.0.0.1', port });
