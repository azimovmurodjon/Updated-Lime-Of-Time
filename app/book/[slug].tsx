import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useColors } from "@/hooks/use-colors";

/**
 * Public route: /book/[slug]
 * 
 * This route handles the public booking URL format:
 *   https://lime-of-time.com/book/business-name
 * 
 * It extracts the slug and redirects to the internal /booking screen
 * which renders the full public booking experience.
 */
export default function BookSlugRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    // Small delay to ensure navigation stack is ready
    const timer = setTimeout(() => {
      router.replace({
        pathname: "/booking",
        params: { slug: slug || "" },
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [slug, router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 16, color: colors.muted, fontSize: 14 }}>
        Loading booking page...
      </Text>
    </View>
  );
}
