import { startServer } from './server.js';

const server = await startServer();
console.log(`Server running on port ${server.port}`);
