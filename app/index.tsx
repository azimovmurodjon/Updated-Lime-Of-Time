import { Redirect } from "expo-router";

/**
 * Root index route — handles the case when the app opens via
 * a deep link scheme (e.g. limeoftime:///) with no specific path.
 * Redirects to the main tabs home screen.
 */
export default function RootIndex() {
  return <Redirect href="/(tabs)" />;
}
