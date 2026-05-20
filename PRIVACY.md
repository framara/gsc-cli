# Privacy Policy

`gsc-cli` is a command-line tool for accessing Google Search Console data from
your own terminal.

## Data Access

`gsc-cli` requests the Google Search Console scope:

```text
https://www.googleapis.com/auth/webmasters
```

This allows the CLI to read and manage Search Console properties that your
Google account can access, including analytics data, sitemap submissions, and
URL inspection results.

## Data Storage

`gsc-cli` stores OAuth tokens locally on your machine at:

```text
~/.config/gsc-cli/tokens.json
```

The project maintainer does not receive, proxy, collect, or store your Google
tokens or Search Console data.

## Data Sharing

`gsc-cli` communicates directly with Google APIs from your machine. It does not
send your Search Console data to any third-party service controlled by this
project.

## Removing Access

Remove the local token:

```bash
gsc auth logout
```

Remove the local token and revoke the refresh token with Google:

```bash
gsc auth logout --revoke
```

You can also remove access from your Google Account security settings.

## Contact

For questions or security concerns, open an issue at:

```text
https://github.com/framara/gsc-cli/issues
```
