# Security policy

## Supported versions

| Version | Supported |
| ------- | ----------- |
| 1.x     | Yes         |

## Reporting a vulnerability

Please use [GitHub Security Advisories](https://github.com/jbdelavoix/moneylize-app/security/advisories/new) to report security issues privately. Do not open a public issue for undisclosed vulnerabilities.

## Scope

This app loads **moneylize.com** inside an Electron `BrowserWindow` with a restricted preload bridge. Financial data and `.mnyl` project files are handled by the web application and local file IPC — credential and file hygiene depend on the user’s system and network environment (see the README security notes).
