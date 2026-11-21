# Forma — launcher and Slides

Forma currently ships as one Windows desktop app containing the launcher and Slides. The project also includes the browser preview used while developing the interface.

## Run the browser preview

```sh
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open `http://localhost:4173` (or the workspace preview).

## Run the desktop app locally

Install Node.js 22 or newer, then run:

```sh
npm ci
npm start
```

## Build a Windows installer

On Windows, run:

```sh
npm ci
npm run dist:win
```

The NSIS installer is written to `release-builds/` as `Forma-Setup-<version>.exe`. It installs per-user by default, creates Start menu and optional desktop shortcuts, and does not delete the user's workspace when the app is uninstalled.

## Publish a Windows release

The GitHub Actions workflow `.github/workflows/release-windows.yml` builds the Windows installer and publishes the installer, `latest.yml`, and update blockmap when a GitHub Release is published. Create the release from a `v*` tag that matches `package.json` (for example, tag `v0.1.0` for version `0.1.0`). The repository's GitHub Actions token needs permission to write release contents; the workflow requests `contents: write`.

Installed copies check GitHub Releases on startup. Updates download in the background; Forma prompts to restart and install, or installs automatically the next time the user quits. The updater replaces the app while workspace data remains in Electron's per-user `userData` folder. A manual update check is also available from the app's Help menu and the launcher settings button.

The current release configuration builds an **unsigned** Windows installer unless the repository secrets `WINDOWS_CERTIFICATE` (base64-encoded signing certificate) and `WINDOWS_CERTIFICATE_PASSWORD` are configured. Windows may show an unknown-publisher / SmartScreen warning until a code-signing certificate is configured. Public releases should be signed before broad distribution.

## What's in this first desktop release

- Forma launcher and Slides editor in one installable app.
- Local workspace persistence, `.forma` import/export, speaker notes, themes, shapes, and image insertion.
- GitHub Releases-based background update checks and safe update-on-restart behavior.

The current `.forma` file format is JSON-based. PowerPoint compatibility and separately installable Writer, Sheets, and PDF Studio apps are not implemented yet.
