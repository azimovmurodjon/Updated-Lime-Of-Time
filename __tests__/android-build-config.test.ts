import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Android Build Configuration", () => {
  const projectRoot = path.resolve(__dirname, "..");

  it("app.config.ts should have minSdkVersion 24 in expo-build-properties", () => {
    const configContent = fs.readFileSync(
      path.join(projectRoot, "app.config.ts"),
      "utf-8"
    );
    // Check that expo-build-properties has minSdkVersion: 24
    expect(configContent).toContain("minSdkVersion: 24");
  });

  it("app.config.ts should have ndkVersion 27.2.12479018 in expo-build-properties", () => {
    const configContent = fs.readFileSync(
      path.join(projectRoot, "app.config.ts"),
      "utf-8"
    );
    // Check that expo-build-properties has the fixed NDK version
    expect(configContent).toContain('ndkVersion: "27.2.12479018"');
  });

  it("app.config.ts should NOT have the buggy NDK version 27.1.12297006", () => {
    const configContent = fs.readFileSync(
      path.join(projectRoot, "app.config.ts"),
      "utf-8"
    );
    expect(configContent).not.toContain("27.1.12297006");
  });

  it("app.config.ts should have compileSdkVersion 36", () => {
    const configContent = fs.readFileSync(
      path.join(projectRoot, "app.config.ts"),
      "utf-8"
    );
    expect(configContent).toContain("compileSdkVersion: 36");
  });

  it("app.config.ts should have targetSdkVersion 36", () => {
    const configContent = fs.readFileSync(
      path.join(projectRoot, "app.config.ts"),
      "utf-8"
    );
    expect(configContent).toContain("targetSdkVersion: 36");
  });

  it("app.config.ts should NOT have buildArchs restriction", () => {
    const configContent = fs.readFileSync(
      path.join(projectRoot, "app.config.ts"),
      "utf-8"
    );
    // buildArchs was removed to avoid architecture-specific issues
    expect(configContent).not.toContain("buildArchs");
  });

  it("withMinSdkVersion plugin should exist and have correct ndkVersion", () => {
    const pluginContent = fs.readFileSync(
      path.join(projectRoot, "plugins", "withMinSdkVersion.js"),
      "utf-8"
    );
    // Plugin should reference the correct NDK version
    expect(pluginContent).toContain("27.2.12479018");
    // Plugin should handle minSdkVersion
    expect(pluginContent).toContain("minSdkVersion");
    // Plugin should handle ndkVersion
    expect(pluginContent).toContain("ndkVersion");
  });

  it("withMinSdkVersion plugin should use withProjectBuildGradle, withAppBuildGradle, and withGradleProperties", () => {
    const pluginContent = fs.readFileSync(
      path.join(projectRoot, "plugins", "withMinSdkVersion.js"),
      "utf-8"
    );
    expect(pluginContent).toContain("withProjectBuildGradle");
    expect(pluginContent).toContain("withAppBuildGradle");
    expect(pluginContent).toContain("withGradleProperties");
  });

  it("app.config.ts should include the custom withMinSdkVersion plugin", () => {
    const configContent = fs.readFileSync(
      path.join(projectRoot, "app.config.ts"),
      "utf-8"
    );
    expect(configContent).toContain("./plugins/withMinSdkVersion");
  });
});
