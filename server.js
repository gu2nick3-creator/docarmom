import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the backend runs with CWD=./server so relative paths (uploads, dist) work on shared hosting.
process.chdir(path.join(__dirname, 'server'));

// Load the actual API server
await import('./server/src/index.js');
