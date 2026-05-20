#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { URL, URLSearchParams } from 'node:url';

const CONFIG_DIR = join(homedir(), '.config', 'gsc-search-console-cli');
const TOKEN_PATH = join(CONFIG_DIR, 'tokens.json');
const AUTH_SCOPE = 'https://www.googleapis.com/auth/webmasters';
const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const WEBMASTERS_BASE_URL = 'https://www.googleapis.com/webmasters/v3';
const INSPECTION_BASE_URL = 'https://searchconsole.googleapis.com/v1';

type TokenStore = {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type CliOptions = Record<string, string | boolean>;

type AnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  try {
    switch (command.join(' ')) {
      case 'auth login':
        await authLogin(options);
        break;
      case 'sites list':
        await listSites(options);
        break;
      case 'sitemaps list':
        await listSitemaps(options);
        break;
      case 'sitemaps submit':
        await submitSitemap(options);
        break;
      case 'sitemaps delete':
        await deleteSitemap(options);
        break;
      case 'inspect':
        await inspectUrl(options);
        break;
      case 'analytics query':
        await analyticsQuery(options);
        break;
      case 'analytics pages':
        await analyticsShortcut(options, ['page']);
        break;
      case 'analytics queries':
        await analyticsShortcut(options, ['query']);
        break;
      case 'help':
      case '':
        printHelp();
        break;
      default:
        throw new Error(`Unknown command: ${command.join(' ')}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): { command: string[]; options: CliOptions } {
  const command: string[] = [];
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg.startsWith('--')) {
      const [rawKey, rawValue] = arg.slice(2).split('=', 2);
      const key = camelCase(rawKey);

      if (rawValue !== undefined) {
        options[key] = rawValue;
        continue;
      }

      const next = args[index + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        index += 1;
      } else {
        options[key] = true;
      }
      continue;
    }

    command.push(arg);
  }

  return { command, options };
}

async function authLogin(options: CliOptions): Promise<void> {
  const clientId = stringOption(options, 'clientId') ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = stringOption(options, 'clientSecret') ?? process.env.GOOGLE_CLIENT_SECRET;
  const port = Number(stringOption(options, 'port') ?? '8787');

  if (!clientId || !clientSecret) {
    throw new Error('Missing --client-id/--client-secret or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET.');
  }

  const redirectUri = `http://127.0.0.1:${port}/oauth2/callback`;
  const code = await receiveOAuthCode({ clientId, redirectUri, port });
  const tokenResponse = await postForm<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  }>(OAUTH_TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  if (!tokenResponse.refresh_token) {
    throw new Error('Google did not return a refresh token. Try logging in again with prompt=consent.');
  }

  await saveTokens({
    clientId,
    clientSecret,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
  });

  console.log(`Authenticated. Tokens saved to ${TOKEN_PATH}`);
}

async function receiveOAuthCode(input: {
  clientId: string;
  redirectUri: string;
  port: number;
}): Promise<string> {
  return await new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      if (!request.url) {
        response.writeHead(400);
        response.end('Missing request URL.');
        return;
      }

      const url = new URL(request.url, input.redirectUri);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        response.writeHead(400);
        response.end(`OAuth failed: ${error}`);
        server.close();
        reject(new Error(`OAuth failed: ${error}`));
        return;
      }

      if (!code) {
        response.writeHead(404);
        response.end('Waiting for OAuth callback.');
        return;
      }

      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('Authentication complete. You can close this tab.');
      server.close();
      resolve(code);
    });

    server.on('error', reject);
    server.listen(input.port, '127.0.0.1', () => {
      const params = new URLSearchParams({
        client_id: input.clientId,
        redirect_uri: input.redirectUri,
        response_type: 'code',
        scope: AUTH_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
      });

      console.log('Open this URL in your browser:');
      console.log(`${OAUTH_AUTH_URL}?${params.toString()}`);
    });
  });
}

async function listSites(options: CliOptions): Promise<void> {
  const data = await googleRequest<{ siteEntry?: unknown[] }>('/sites');
  printResult(data.siteEntry ?? [], options);
}

async function listSitemaps(options: CliOptions): Promise<void> {
  const site = requiredOption(options, 'site');
  const data = await googleRequest<{ sitemap?: unknown[] }>(`/sites/${encodePath(site)}/sitemaps`);
  printResult(data.sitemap ?? [], options);
}

async function submitSitemap(options: CliOptions): Promise<void> {
  const site = requiredOption(options, 'site');
  const url = requiredOption(options, 'url');
  await googleRequest(`/sites/${encodePath(site)}/sitemaps/${encodePath(url)}`, {
    method: 'PUT',
  });
  printResult({ submitted: url, site }, options);
}

async function deleteSitemap(options: CliOptions): Promise<void> {
  const site = requiredOption(options, 'site');
  const url = requiredOption(options, 'url');
  await googleRequest(`/sites/${encodePath(site)}/sitemaps/${encodePath(url)}`, {
    method: 'DELETE',
  });
  printResult({ deleted: url, site }, options);
}

async function inspectUrl(options: CliOptions): Promise<void> {
  const site = requiredOption(options, 'site');
  const url = requiredOption(options, 'url');
  const languageCode = stringOption(options, 'languageCode') ?? 'en-US';

  const data = await googleRequest('/urlInspection/index:inspect', {
    baseUrl: INSPECTION_BASE_URL,
    method: 'POST',
    body: {
      inspectionUrl: url,
      siteUrl: site,
      languageCode,
    },
  });

  printResult(data, options);
}

async function analyticsShortcut(options: CliOptions, dimensions: string[]): Promise<void> {
  const days = Number(stringOption(options, 'days') ?? '28');
  const endDate = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const startDate = formatDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

  await runAnalytics({
    options,
    dimensions,
    startDate,
    endDate,
    rowLimit: Number(stringOption(options, 'limit') ?? '25'),
  });
}

async function analyticsQuery(options: CliOptions): Promise<void> {
  const dimensions = (stringOption(options, 'dimensions') ?? 'query,page')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  await runAnalytics({
    options,
    dimensions,
    startDate: requiredOption(options, 'from'),
    endDate: requiredOption(options, 'to'),
    rowLimit: Number(stringOption(options, 'limit') ?? '100'),
  });
}

async function runAnalytics(input: {
  options: CliOptions;
  dimensions: string[];
  startDate: string;
  endDate: string;
  rowLimit: number;
}): Promise<void> {
  const site = requiredOption(input.options, 'site');
  const data = await googleRequest<{ rows?: AnalyticsRow[] }>(
    `/sites/${encodePath(site)}/searchAnalytics/query`,
    {
      method: 'POST',
      body: {
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: input.dimensions,
        rowLimit: input.rowLimit,
      },
    },
  );

  printResult(data.rows ?? [], input.options);
}

async function googleRequest<T = unknown>(
  path: string,
  options: {
    baseUrl?: string;
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${options.baseUrl ?? WEBMASTERS_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google API error ${response.status}: ${text}`);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }

  return (await response.json()) as T;
}

async function getAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  const refreshSkewMs = 60_000;

  if (tokens.expiresAt > Date.now() + refreshSkewMs) {
    return tokens.accessToken;
  }

  const refreshed = await postForm<{
    access_token: string;
    expires_in: number;
  }>(OAUTH_TOKEN_URL, {
    client_id: tokens.clientId,
    client_secret: tokens.clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: 'refresh_token',
  });

  const nextTokens = {
    ...tokens,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  };
  await saveTokens(nextTokens);
  return nextTokens.accessToken;
}

async function postForm<T>(url: string, values: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth error ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

async function loadTokens(): Promise<TokenStore> {
  try {
    return JSON.parse(await readFile(TOKEN_PATH, 'utf8')) as TokenStore;
  } catch {
    throw new Error(`Not authenticated. Run: gsc auth login`);
  }
}

async function saveTokens(tokens: TokenStore): Promise<void> {
  await mkdir(dirname(TOKEN_PATH), { recursive: true, mode: 0o700 });
  await writeFile(TOKEN_PATH, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
}

function printResult(value: unknown, options: CliOptions): void {
  if (options.json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (Array.isArray(value)) {
    printTable(value);
    return;
  }

  console.log(JSON.stringify(value, null, 2));
}

function printTable(rows: unknown[]): void {
  if (rows.length === 0) {
    console.log('No rows.');
    return;
  }

  const normalized = rows.map(flattenRow);
  const columns = Array.from(new Set(normalized.flatMap((row) => Object.keys(row))));
  const widths = columns.map((column) =>
    Math.max(column.length, ...normalized.map((row) => String(row[column] ?? '').length)),
  );

  console.log(columns.map((column, index) => column.padEnd(widths[index])).join('  '));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));

  for (const row of normalized) {
    console.log(columns.map((column, index) => String(row[column] ?? '').padEnd(widths[index])).join('  '));
  }
}

function flattenRow(row: unknown): Record<string, string | number> {
  if (!isObject(row)) {
    return { value: String(row) };
  }

  const output: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'keys' && Array.isArray(value)) {
      value.forEach((item, index) => {
        output[`key${index + 1}`] = String(item);
      });
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      output[key] = typeof value === 'boolean' ? String(value) : value;
      continue;
    }

    output[key] = JSON.stringify(value);
  }
  return output;
}

function requiredOption(options: CliOptions, key: string): string {
  const value = stringOption(options, key);
  if (!value) {
    throw new Error(`Missing required option --${kebabCase(key)}.`);
  }
  return value;
}

function stringOption(options: CliOptions, key: string): string | undefined {
  const value = options[key];
  return typeof value === 'string' ? value : undefined;
}

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function camelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function printHelp(): void {
  console.log(`gsc-search-console-cli

Usage:
  gsc auth login --client-id <id> --client-secret <secret>
  gsc sites list [--json]
  gsc sitemaps list --site <site> [--json]
  gsc sitemaps submit --site <site> --url <sitemap-url>
  gsc sitemaps delete --site <site> --url <sitemap-url>
  gsc inspect --site <site> --url <url> [--json]
  gsc analytics pages --site <site> [--days 28] [--limit 25] [--json]
  gsc analytics queries --site <site> [--days 28] [--limit 25] [--json]
  gsc analytics query --site <site> --from YYYY-MM-DD --to YYYY-MM-DD --dimensions query,page
`);
}

await main();
