# Build a Windows executable with Tauri

Use this guide to verify the local toolchain and build the Windows NSIS installer through Tauri.

## Before you start

Tauri is initialized in this repository under `src-tauri/`. The Windows packaging path is `npm run build:win`, which builds an NSIS installer.

Current status for this machine:

- `npm run test -- --run` passed with 26 test files and 196 tests.
- `npm run build` passed.
- `rustc`, `cargo`, and `rustup` are not installed or not available on `PATH`.
- The current shell does not expose `rustc`, `cargo`, or `cl` on `PATH`, but Rust is installed under the default Cargo bin directory.

If `npm run build:win` fails with toolchain errors, verify the prerequisites below before changing any repo files.

## Prerequisites

Install and verify all of the following:

1. Node.js 18 or newer
2. Rust toolchain with an MSVC host target
3. Microsoft Visual Studio C++ Build Tools
4. Microsoft Edge WebView2 Runtime

## Verify Node.js

Run:

```powershell
node --version
npm --version
```

Expected result:

- Node reports version 18 or newer.
- npm is available.

## Install and verify Rust with MSVC

Install Rust by following the standard `rustup` installer flow for Windows, making sure the installed host target is MSVC.

Then verify:

```powershell
rustup --version
rustc -Vv
cargo --version
rustup show
```

Expected result:

- All four commands succeed.
- `rustc -Vv` shows an `x86_64-pc-windows-msvc` host, or another Windows MSVC host appropriate for the machine.

Current machine status:

- These commands cannot be completed yet because `rustup`, `rustc`, and `cargo` are currently missing or not on `PATH`.

## Verify Microsoft C++ Build Tools

Tauri on Windows requires the Microsoft C++ toolchain.

Check for the Visual C++ compiler:

```powershell
cl
```

If that does not work, check whether Visual Studio Build Tools are installed in their default location:

```powershell
Test-Path "C:\Program Files\Microsoft Visual Studio"
```

Expected result:

- `cl` is available from a Developer Command Prompt, or
- the Visual Studio Build Tools installation is present and can be configured for command-line use.

Current machine status:

- This has not been verified yet.

## Verify WebView2 Runtime

Tauri uses WebView2 on Windows.

Check for a common runtime install location:

```powershell
Test-Path "$Env:ProgramFiles(x86)\Microsoft\EdgeWebView\Application"
```

Optional registry check:

```powershell
reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients" /s | findstr WebView2
```

Expected result:

- At least one check indicates that WebView2 Runtime is installed.

Current machine status:

- This has not been verified yet.

## Build once Tauri is initialized

To build the app and installer, run:

```powershell
npm install
npm run test -- --run
npm run build
npm run build:win
```

Expected result:

- The web app builds successfully.
- The Tauri build produces an NSIS installer under `src-tauri/target/release/bundle/nsis/`.

## If the build is blocked

If `rustup`, `rustc`, or `cargo` are missing from `PATH`, stop there first. Do not continue until:

- the Rust MSVC toolchain is installed and reachable from the shell,
- Microsoft C++ Build Tools are confirmed,
- WebView2 Runtime is confirmed.
