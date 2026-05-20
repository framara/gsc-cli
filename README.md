# gsc-cli

A small CLI for Google Search Console analytics, sitemaps, verified sites, and URL inspection.

It uses Google's OAuth installed-app flow and direct REST calls. After build, the CLI has no runtime npm dependencies.

## Install

Once published to npm:

```bash
npm install -g @framara/gsc-cli
```

Then run it from anywhere:

```bash
gsc help
```

You can also run it without a permanent global install:

```bash
npx @framara/gsc-cli help
```

## Local Development

```bash
git clone https://github.com/framara/gsc-cli.git
cd gsc-cli
pnpm install
pnpm build
pnpm link --global
```

After linking, the `gsc` command is available globally on your machine:

```bash
gsc help
```

To unlink later:

```bash
pnpm remove --global @framara/gsc-cli
```

## Login

Authenticate with Google:

```bash
gsc auth login
```

The CLI opens a browser, asks you to approve Google Search Console access, and
stores tokens locally.

If you are on a remote machine or do not want the browser to open
automatically:

```bash
gsc auth login --no-browser
```

The CLI will print the login URL instead.

Tokens are stored at:

```text
~/.config/gsc-cli/tokens.json
```

Check whether the CLI is authenticated:

```bash
gsc auth status
```

Remove the local token:

```bash
gsc auth logout
```

Remove the local token and ask Google to revoke the stored refresh token:

```bash
gsc auth logout --revoke
```

## Advanced Auth

Published builds should include the default `gsc-cli` OAuth client so normal
users do not need to create Google Cloud credentials.

The bundled OAuth client is a Google Desktop app client. Desktop app client
credentials are distributed with the application and are not treated like server
secrets. Users still grant access with their own Google account, and tokens are
stored only on the user's machine.

The public repository keeps those values out of source because GitHub secret
scanning blocks OAuth client values. Release builds inject them into `dist/`
from environment variables:

```bash
GSC_CLI_DEFAULT_CLIENT_ID="..." \
GSC_CLI_DEFAULT_CLIENT_SECRET="..." \
pnpm build
```

For development, forks, or private deployments, you can bring your own OAuth
client. Create OAuth credentials in Google Cloud:

1. Create or select a Google Cloud project.
2. Enable the **Google Search Console API**.
3. Configure the OAuth consent screen.
4. Create an OAuth client ID for a **Desktop app**.
5. Download the OAuth JSON file or copy the Client ID and Client Secret.

Use the downloaded JSON file:

```bash
gsc auth login --client-config ~/Downloads/client_secret.json
```

Or pass credentials directly:

```bash
gsc auth login \
  --client-id "$GOOGLE_CLIENT_ID" \
  --client-secret "$GOOGLE_CLIENT_SECRET"
```

## Commands

List verified properties:

```bash
gsc sites list
```

Submit a sitemap:

```bash
gsc sitemaps submit \
  --site https://whatthemeta.io/ \
  --url https://whatthemeta.io/sitemap.xml
```

List sitemaps:

```bash
gsc sitemaps list --site https://whatthemeta.io/
```

Delete a sitemap submission:

```bash
gsc sitemaps delete \
  --site https://whatthemeta.io/ \
  --url https://whatthemeta.io/sitemap.xml
```

Inspect a URL:

```bash
gsc inspect \
  --site https://whatthemeta.io/ \
  --url https://whatthemeta.io/wow-mythic-plus-meta
```

Top pages for the last 28 days:

```bash
gsc analytics pages --site https://whatthemeta.io/ --days 28
```

Top queries for the last 28 days:

```bash
gsc analytics queries --site https://whatthemeta.io/ --days 28
```

Custom Search Analytics query:

```bash
gsc analytics query \
  --site https://whatthemeta.io/ \
  --from 2026-05-01 \
  --to 2026-05-20 \
  --dimensions query,page \
  --limit 50
```

Add `--json` to most commands for machine-readable output:

```bash
gsc analytics pages --site https://whatthemeta.io/ --days 28 --json
```

## Publishing

Dry-run the npm package contents:

```bash
pnpm pack:dry
```

Publish publicly:

```bash
npm publish --access public
```

Before a public release, review [`PRIVACY.md`](./PRIVACY.md) and complete any
Google OAuth verification steps requested for the Search Console scope.

To build the public npm package with the default OAuth client:

```bash
GSC_CLI_DEFAULT_CLIENT_ID="..." \
GSC_CLI_DEFAULT_CLIENT_SECRET="..." \
npm publish --access public
```

## Notes

This CLI can submit sitemaps and inspect URL index status. Google does not provide a general public Search Console API endpoint that exactly mirrors the manual "Request indexing" button for normal web pages.
