import { Redirect } from "expo-router";

/**
 * Catch-all route for any unmatched paths.
 * Instead of showing an error, redirect to the home screen.
 * This handles cases like deep link schemes opening with empty paths.
 */
export default function NotFoundScreen() {
  return <Redirect href="/(tabs)" />;
}
