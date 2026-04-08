/**
 * Custom Expo Config Plugin to force minSdkVersion and ndkVersion in Android build.
 * 
 * This plugin addresses a known issue where NDK 27.1.12297006 (the default for RN 0.81)
 * has a bug that causes CMake to default minSdkVersion to 22, ignoring gradle.properties.
 * See: https://github.com/expo/expo/issues/38667
 * 
 * Fix: Override ndkVersion to 27.2.12479018 (NDK r27c) which doesn't have this bug,
 * and ensure minSdkVersion is set to 24 everywhere.
 * 
 * This plugin directly modifies:
 * 1. android/build.gradle - sets minSdkVersion and ndkVersion in ext block
 * 2. android/gradle.properties - sets android.minSdkVersion and android.ndkVersion
 * 3. android/app/build.gradle - ensures minSdkVersion and ndkVersion in defaultConfig
 */
const { 
  withProjectBuildGradle, 
  withAppBuildGradle, 
  withGradleProperties 
} = require("expo/config-plugins");

function withMinSdkVersion(config, { minSdkVersion = 24, ndkVersion = "27.2.12479018" } = {}) {
  // Step 1: Modify the project-level build.gradle to set minSdkVersion and ndkVersion in ext block
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;
      
      // Replace minSdkVersion in the ext block if it exists
      // Pattern: minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '...')
      contents = contents.replace(
        /minSdkVersion\s*=\s*Integer\.parseInt\(findProperty\('android\.minSdkVersion'\)\s*\?:\s*'(\d+)'\)/,
        `minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '${minSdkVersion}')`
      );
      
      // Also try direct assignment pattern for minSdkVersion
      contents = contents.replace(
        /minSdkVersion\s*=\s*(\d+)/g,
        `minSdkVersion = ${minSdkVersion}`
      );
      
      // Replace ndkVersion in the ext block
      // Pattern: ndkVersion = findProperty('android.ndkVersion') ?: "..."
      contents = contents.replace(
        /ndkVersion\s*=\s*findProperty\('android\.ndkVersion'\)\s*\?:\s*"[^"]*"/,
        `ndkVersion = findProperty('android.ndkVersion') ?: "${ndkVersion}"`
      );
      
      // Also try direct string assignment pattern for ndkVersion
      contents = contents.replace(
        /ndkVersion\s*=\s*"[^"]*"/g,
        `ndkVersion = "${ndkVersion}"`
      );
      
      config.modResults.contents = contents;
    }
    return config;
  });

  // Step 2: Modify the app-level build.gradle to ensure minSdkVersion and ndkVersion
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;
      
      // Ensure minSdkVersion in defaultConfig
      contents = contents.replace(
        /minSdkVersion\s+rootProject\.ext\.minSdkVersion/g,
        `minSdkVersion ${minSdkVersion}`
      );
      
      // Also handle the pattern where minSdkVersion reads from a property
      contents = contents.replace(
        /minSdk\s*=?\s*(\d+)/g,
        (match) => {
          // Only replace if the number is less than our target
          const num = parseInt(match.match(/\d+/)[0]);
          if (num < minSdkVersion) {
            return match.replace(/\d+/, String(minSdkVersion));
          }
          return match;
        }
      );
      
      // Force ndkVersion in the android block if present
      contents = contents.replace(
        /ndkVersion\s+rootProject\.ext\.ndkVersion/g,
        `ndkVersion "${ndkVersion}"`
      );
      
      config.modResults.contents = contents;
    }
    return config;
  });

  // Step 3: Ensure gradle.properties has the correct values
  config = withGradleProperties(config, (config) => {
    // Remove existing entries
    config.modResults = config.modResults.filter(
      (item) => !(item.type === "property" && 
        (item.key === "android.minSdkVersion" || item.key === "android.ndkVersion"))
    );
    
    // Add the correct values
    config.modResults.push({
      type: "property",
      key: "android.minSdkVersion",
      value: String(minSdkVersion),
    });
    
    config.modResults.push({
      type: "property",
      key: "android.ndkVersion",
      value: ndkVersion,
    });
    
    // Also set newArchEnabled minSdkVersion to prevent CMake from using 22
    config.modResults.push({
      type: "property",
      key: "android.minSdk",
      value: String(minSdkVersion),
    });
    
    return config;
  });

  return config;
}

module.exports = withMinSdkVersion;
