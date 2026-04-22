# Xcode Setup Guide — Lime Of Time

This branch (`ios-xcode`) contains the pre-generated native iOS code ready to open in Xcode.

---

## Requirements

| Tool | Version |
|------|---------|
| macOS | Ventura 13+ or Sonoma 14+ |
| Xcode | 15.x or 16.x |
| CocoaPods | 1.14+ (`sudo gem install cocoapods`) |
| Node.js | 18+ |
| pnpm | 9.x (`npm install -g pnpm@9`) |

---

## Step-by-Step Setup

### 1. Clone the branch

```bash
git clone --branch ios-xcode <your-repo-url> manus-scheduler
cd manus-scheduler
```

### 2. Install JavaScript dependencies

```bash
pnpm install
```

### 3. Install CocoaPods (iOS native dependencies)

```bash
cd ios
pod install
cd ..
```

> This will create `ios/LimeOfTime.xcworkspace` — **always open the `.xcworkspace` file, NOT `.xcodeproj`**.

### 4. Open in Xcode

```bash
open ios/LimeOfTime.xcworkspace
```

### 5. Select a simulator

In Xcode, click the device selector at the top (next to the scheme name) and choose any simulator:
- iPhone 15 Pro (recommended)
- iPhone 14
- iPhone 13 mini
- iPad Pro (any size)

### 6. Start the Metro bundler (in a separate terminal)

```bash
pnpm dev:metro
```

> Metro must be running before you launch the app in the simulator.

### 7. Build and run

Press **⌘R** in Xcode or click the **▶ Run** button.

---

## App Details

| Property | Value |
|----------|-------|
| App Name | Lime Of Time |
| Bundle ID | `space.manus.manus.scheduler.t20260406102824` |
| Deployment Target | iOS 15.1+ |
| Scheme | `LimeOfTime` |

---

## Troubleshooting

### "No such module 'Expo'" or pod errors
```bash
cd ios && pod deintegrate && pod install
```

### Metro bundler not connecting
Make sure Metro is running (`pnpm dev:metro`) before launching from Xcode.

### Build fails with "Signing" error
In Xcode → Targets → LimeOfTime → Signing & Capabilities:
- Check **Automatically manage signing**
- Select your Apple Developer Team

### "Unable to boot simulator"
Open Xcode → Window → Devices and Simulators → create a new simulator.

---

## Updating native code after JS changes

If you change `app.config.ts` (permissions, plugins, etc.), re-run prebuild:

```bash
npx expo prebuild --platform ios
cd ios && pod install
```

Then rebuild in Xcode.
