import dotenv from 'dotenv';
import path from 'path';

// Root .env takes priority; api/.env is the fallback for api-only environments.
// This module must be the first import in any entry point so env vars are set
// before other modules (especially db/client) read them.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
