# TestFlight Deployment Guide — Lime Of Time

This guide walks you through pulling the latest code from GitHub and deploying a new build to TestFlight using Expo Application Services (EAS).

---

## Prerequisites

Before you begin, ensure the following are in place on your development machine.

| Requirement | Details |
|---|---|
| **Node.js** | v18 or later (`node -v`) |
| **pnpm** | v9 (`npm install -g pnpm`) |
| **EAS CLI** | `npm install -g eas-cli` |
| **Expo account** | [expo.dev](https://expo.dev) — free account is sufficient |
| **Apple Developer account** | Paid membership ($99/year) required for TestFlight |
| **Xcode** | Latest stable version (macOS only, for local builds) |

---

## Step 1 — Pull the Latest Code

```bash
# Navigate to your project directory (or clone fresh if needed)
git clone https://github.com/azimovmurodjon/Updated-Lime-Of-Time.git
cd Updated-Lime-Of-Time

# Or, if you already have the repo:
git pull origin main

# Install dependencies
pnpm install
```

---

## Step 2 — Log In to EAS

```bash
eas login
```

Enter your Expo account credentials. Verify you are logged in:

```bash
eas whoami
```

---

## Step 3 — Configure EAS (First Time Only)

If `eas.json` does not already exist in the project root, run:

```bash
eas build:configure
```

This creates `eas.json` with build profiles. The project already has this file configured, so you can skip this step on subsequent builds.

**Key app identifiers for Lime Of Time:**

| Field | Value |
|---|---|
| **App Name** | Lime Of Time |
| **Bundle ID (iOS)** | `space.manus.manus.scheduler.t20260406102824` |
| **Expo Slug** | `manus-scheduler` |

---

## Step 4 — Build for TestFlight

EAS builds happen in the cloud — you do not need Xcode installed for this step.

### Option A — Preview Build (Recommended for Testing)

A preview build is faster, cheaper, and ideal for internal testing via TestFlight.

```bash
eas build --platform ios --profile preview
```

### Option B — Production Build

Use this when you are ready to submit to the App Store or want a production-signed TestFlight build.

```bash
eas build --platform ios --profile production
```

**What happens next:**

1. EAS will prompt you to log in to your Apple Developer account (first time only).
2. EAS automatically handles provisioning profiles and signing certificates.
3. The build is queued on Expo's cloud servers (typically 10–20 minutes).
4. You will receive an email when the build is complete.
5. The `.ipa` file URL will be shown in the terminal and at [expo.dev/builds](https://expo.dev/builds).

---

## Step 5 — Submit to TestFlight

Once the build is complete, submit it directly from EAS:

```bash
eas submit --platform ios --latest
```

This uploads the most recent successful iOS build to App Store Connect. EAS will prompt for your Apple ID and app-specific password (or use an API key if configured).

**Alternatively**, submit a specific build by its ID:

```bash
eas submit --platform ios --id <build-id>
```

The build ID is shown in the terminal output or at [expo.dev/builds](https://expo.dev/builds).

---

## Step 6 — Invite Testers in App Store Connect

1. Open [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. Navigate to **My Apps → Lime Of Time → TestFlight**.
3. Wait for the build to finish processing (usually 5–15 minutes after upload).
4. Under **Internal Testing**, add testers by Apple ID email.
5. Under **External Testing**, create a group and add testers — external testing requires a brief Apple review (typically 1–2 business days).
6. Testers receive an email invitation to install the app via the **TestFlight** app on their iPhone.

---

## Updating an Existing TestFlight Build

For every new version you want testers to receive:

```bash
git pull origin main
pnpm install
eas build --platform ios --profile preview
eas submit --platform ios --latest
```

TestFlight automatically notifies existing testers when a new build is available.

---

## Incrementing the Version Number

Before each new submission, update the version in `app.config.ts`:

```ts
version: "1.0.1",  // Increment for each new build
```

Also increment the iOS build number if required by App Store Connect:

```ts
ios: {
  buildNumber: "2",  // Must be higher than the previous submission
  ...
}
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `eas: command not found` | Run `npm install -g eas-cli` |
| Apple login fails | Use an [app-specific password](https://support.apple.com/en-us/102654) instead of your main Apple ID password |
| Build fails with provisioning error | Run `eas credentials` to reset and regenerate certificates |
| "Missing push notification entitlement" | Add `aps-environment` entitlement via `eas credentials` or Xcode |
| Build queued for too long | Check [status.expo.dev](https://status.expo.dev) for service incidents |
| TestFlight shows "Missing Compliance" | Add `ITSAppUsesNonExemptEncryption = false` to `ios/Info.plist` or set it in `app.config.ts` via `infoPlist` |

---

## Useful Commands Reference

```bash
# Check current EAS build status
eas build:list --platform ios

# View build logs
eas build:view <build-id>

# Check credentials
eas credentials

# Run TypeScript check before building
npx tsc --noEmit

# Run locally on iOS simulator (requires macOS + Xcode)
pnpm ios
```

---

*Guide prepared for Lime Of Time — Expo SDK 54, Bundle ID: `space.manus.manus.scheduler.t20260406102824`*
