import { readFile, writeFile } from 'node:fs/promises';

const outputPath = new URL('../dist/index.js', import.meta.url);
const clientId = process.env.GSC_CLI_DEFAULT_CLIENT_ID ?? '';
const clientSecret = process.env.GSC_CLI_DEFAULT_CLIENT_SECRET ?? '';

let output = await readFile(outputPath, 'utf8');

if (clientId || clientSecret) {
  if (!clientId || !clientSecret) {
    throw new Error(
      'Both GSC_CLI_DEFAULT_CLIENT_ID and GSC_CLI_DEFAULT_CLIENT_SECRET are required.',
    );
  }

  output = output
    .replaceAll('__GSC_CLI_DEFAULT_CLIENT_ID__', clientId)
    .replaceAll('__GSC_CLI_DEFAULT_CLIENT_SECRET__', clientSecret);
}

await writeFile(outputPath, output);
