/**
 * Regenerate docs/receptionist/*.generated.* without calling Retell.
 * Uses APP_BASE_URL from env if set, otherwise a placeholder.
 */
import { config as loadEnv } from 'dotenv';
import * as path from 'path';

import { writeGeneratedDocs } from '../src/lib/receptionist/retell-setup/writeGeneratedDocs';

const repoRoot = process.cwd();
loadEnv({ path: path.join(repoRoot, '.env'), quiet: true });
loadEnv({ path: path.join(repoRoot, '.env.local'), override: true, quiet: true });

const base =
  process.env.APP_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
  'https://YOUR_PUBLIC_APP_BASE_URL';

writeGeneratedDocs(repoRoot, { appBasePlaceholder: base.replace(/\/+$/, '') });
console.log(`Wrote docs under docs/receptionist/ (APP_BASE_URL=${base.replace(/\/+$/, '')})`);
