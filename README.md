# gsc-search-console-cli

A small CLI for Google Search Console analytics, sitemaps, verified sites, and URL inspection.

It uses Google's OAuth installed-app flow and direct REST calls. After build, the CLI has no runtime npm dependencies.

## Install

Once published to npm:

```bash
npm install -g @framara/gsc-search-console-cli
```

Then run it from anywhere:

```bash
gsc help
```

You can also run it without a permanent global install:

```bash
npx @framara/gsc-search-console-cli help
```

## Local Development

```bash
git clone https://github.com/framara/gsc-search-console-cli.git
cd gsc-search-console-cli
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
pnpm remove --global @framara/gsc-search-console-cli
```

## Google Setup

Create OAuth credentials in Google Cloud:

1. Create or select a Google Cloud project.
2. Enable the **Google Search Console API**.
3. Configure the OAuth consent screen.
4. Create an OAuth client ID for a **Desktop app**.
5. Copy the Client ID and Client Secret.

Authenticate the CLI:

```bash
gsc auth login \
  --client-id "$GOOGLE_CLIENT_ID" \
  --client-secret "$GOOGLE_CLIENT_SECRET"
```

The CLI prints a Google login URL. Open it, approve access, and the local callback will save tokens at:

```text
~/.config/gsc-search-console-cli/tokens.json
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

## Notes

This CLI can submit sitemaps and inspect URL index status. Google does not provide a general public Search Console API endpoint that exactly mirrors the manual "Request indexing" button for normal web pages.
