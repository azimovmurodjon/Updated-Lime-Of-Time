// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "com.azimov.limeoftime";
const schemeFromBundleId = "limeoftime";

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "Lime Of Time",
  appSlug: "manus-scheduler",
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  logoUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/jHoNjHdLsUGgpFhz.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: false, // Disabled for iOS 26 beta compatibility (TurboModules crash on iOS 26)
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    buildNumber: "10",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#F0FFF0",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-image-picker",
    [
      "expo-contacts",
      {
        contactsPermission: "Allow $(PRODUCT_NAME) to access your contacts to import clients.",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 280,
        resizeMode: "contain",
        backgroundColor: "#F0FFF0",
        dark: {
          backgroundColor: "#1a2e1a",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          ndkVersion: "27.2.12479018",
        },
      },
    ],
    [
      "./plugins/withMinSdkVersion",
      {
        minSdkVersion: 24,
        ndkVersion: "27.2.12479018",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "031e5de6-3a21-4c81-97b3-e50ec17148ac",
    },
  },
  owner: "azimovmurodjon",
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
