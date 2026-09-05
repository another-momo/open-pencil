# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues or pull requests.

If you believe you have found a security issue in OpenPencil, report it privately using GitHub Security Advisories:

https://github.com/open-pencil/open-pencil/security/advisories/new

Please include as much detail as possible:

- Affected version or commit
- Reproduction steps
- Proof of concept, if available
- Expected impact
- Whether the issue is already public

We will investigate privately before discussing details in public. If the report is confirmed, we will coordinate a fix and credit the reporter unless they prefer not to be named.

## Disclosure

Please give us a reasonable opportunity to investigate and release a fix before publishing details publicly.

## Automation bridge

The automation bridge (spawned by the dev server or the production host) binds to `127.0.0.1` by default — a Unix domain socket on macOS/Linux with owner-only permissions, localhost TCP otherwise — and requires a bearer token for `/rpc` unless explicitly disabled.
