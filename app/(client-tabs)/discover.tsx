/**
 * Client Portal — Discover Screen
 *
 * Browse businesses by category and distance.
 * Scrollable card list with search, category filter, and radius picker.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore, DiscoverBusiness } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FuturisticBackground } from "@/components/futuristic-background";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { getApiBaseUrl } from "@/constants/oauth";

const CATEGORIES = [
  { label: "All", emoji: "🔍" },
  { label: "Hair", emoji: "✂️" },
  { label: "Nails", emoji: "💅" },
  { label: "Skin", emoji: "✨" },
  { label: "Massage", emoji: "💆" },
  { label: "Fitness", emoji: "🏋️" },
  { label: "Dental", emoji: "🦷" },
  { label: "Medical", emoji: "🏥" },
  { label: "Spa", emoji: "🧖" },
  { label: "Barber", emoji: "💈" },
  { label: "Tattoo", emoji: "🎨" },
  { label: "Other", emoji: "📍" },
];

// Radius options in miles
const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

// Category accent colors
const CATEGORY_COLORS: Record<string, string> = {
  Hair: "#8B5CF6",
  Nails: "#EC4899",
  Skin: "#F59E0B",
  Massage: "#10B981",
  Fitness: "#3B82F6",
  Dental: "#06B6D4",
  Medical: "#EF4444",
  Spa: "#8B5CF6",
  Barber: "#6366F1",
  Tattoo: "#F97316",
  Other: "#6B7280",
  All: "#8B5CF6",
};

function kmToMiles(km: number): number {
  return km * 0.621371;
}

export default function DiscoverScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch } = useClientStore();

  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);

  const apiBase = getApiBaseUrl();

  const fetchBusinesses = useCallback(async (lat?: number, lng?: number, query?: string, category?: string | null, radius?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lat != null) params.set("lat", String(lat));
      if (lng != null) params.set("lng", String(lng));
      if (query) params.set("q", query);
      if (category && category !== "All") params.set("category", category);
      if (radius) params.set("radiusMiles", String(radius));
      const res = await fetch(`${apiBase}/api/client/businesses/discover?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        // API returns { businesses: [...] } or plain array
        const data: DiscoverBusiness[] = Array.isArray(json) ? json : (json.businesses ?? []);
        setBusinesses(data);
      }
    } catch (err) {
      console.warn("[Discover] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // Get user location on mount
  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError("Location access denied. Showing all businesses.");
          fetchBusinesses(undefined, undefined, searchQuery, state.discoverCategory, state.discoverRadius);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
        fetchBusinesses(loc.coords.latitude, loc.coords.longitude, searchQuery, state.discoverCategory, state.discoverRadius);
      } catch {
        setLocationError("Could not get location. Showing all businesses.");
        fetchBusinesses(undefined, undefined, searchQuery, state.discoverCategory, state.discoverRadius);
      }
    })();
  }, []));

  const handleSearch = () => {
    fetchBusinesses(userLat ?? undefined, userLng ?? undefined, searchQuery, state.discoverCategory, state.discoverRadius);
  };

  const handleCategorySelect = (cat: string) => {
    const newCat = cat === "All" ? null : cat;
    dispatch({ type: "SET_DISCOVER_CATEGORY", payload: newCat });
    fetchBusinesses(userLat ?? undefined, userLng ?? undefined, searchQuery, newCat, state.discoverRadius);
  };

  const handleRadiusSelect = (r: number) => {
    dispatch({ type: "SET_DISCOVER_RADIUS", payload: r });
    setShowRadiusPicker(false);
    fetchBusinesses(userLat ?? undefined, userLng ?? undefined, searchQuery, state.discoverCategory, r);
  };

  const activeCategory = state.discoverCategory ?? "All";

  const s = styles(colors);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <FuturisticBackground />

      {/* Search Bar + Radius */}
      <View style={s.searchRow}>
        <View style={[s.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            placeholder="Search businesses..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(""); fetchBusinesses(userLat ?? undefined, userLng ?? undefined, "", state.discoverCategory, state.discoverRadius); }}>
              <IconSymbol name="xmark.circle.fill" size={15} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [s.radiusBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          onPress={() => setShowRadiusPicker((v) => !v)}
        >
          <IconSymbol name="location.fill" size={13} color="#8B5CF6" />
          <Text style={{ color: "#8B5CF6", fontSize: 12, fontWeight: "700" }}>{state.discoverRadius} mi</Text>
        </Pressable>
      </View>

      {/* Radius picker dropdown */}
      {showRadiusPicker && (
        <View style={[s.radiusPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {RADIUS_OPTIONS.map((r) => (
            <Pressable
              key={r}
              style={({ pressed }) => [s.radiusOption, state.discoverRadius === r && { backgroundColor: "#8B5CF615" }, pressed && { opacity: 0.7 }]}
              onPress={() => handleRadiusSelect(r)}
            >
              <Text style={{ color: state.discoverRadius === r ? "#8B5CF6" : colors.foreground, fontWeight: state.discoverRadius === r ? "700" : "400", fontSize: 14 }}>
                {r} miles
              </Text>
              {state.discoverRadius === r && <IconSymbol name="checkmark" size={13} color="#8B5CF6" />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Location error banner */}
      {locationError && (
        <View style={[s.locationBanner, { backgroundColor: colors.warning + "20" }]}>
          <IconSymbol name="location.slash.fill" size={13} color={colors.warning} />
          <Text style={{ color: colors.warning, fontSize: 12, flex: 1 }}>{locationError}</Text>
        </View>
      )}

      {/* Category chips — fixed height horizontal scroll */}
      <View style={s.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoryRow}
          style={s.categoryScroll}
        >
          {CATEGORIES.map(({ label, emoji }) => {
            const isActive = activeCategory === label;
            const accentColor = CATEGORY_COLORS[label] ?? "#8B5CF6";
            return (
              <Pressable
                key={label}
                style={({ pressed }) => [
                  s.categoryChip,
                  {
                    backgroundColor: isActive ? accentColor : colors.surface,
                    borderColor: isActive ? accentColor : colors.border,
                  },
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => handleCategorySelect(label)}
              >
                <Text style={s.categoryEmoji}>{emoji}</Text>
                <Text style={[s.categoryLabel, { color: isActive ? "#FFFFFF" : colors.foreground }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Results */}
      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={[s.loadingText, { color: colors.muted }]}>Finding businesses near you...</Text>
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Text style={s.emptyIcon}>📍</Text>
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {userLat != null ? "No businesses nearby" : "No businesses found"}
              </Text>
              <Text style={[s.emptySubtitle, { color: colors.muted }]}>
                {userLat != null
                  ? `No businesses available within ${state.discoverRadius} miles. Try increasing your range or changing the category.`
                  : "No businesses match your search. Try a different keyword or category."}
              </Text>
              {userLat != null && (
                <Pressable
                  style={({ pressed }) => [s.expandBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    const nextRadius = RADIUS_OPTIONS[Math.min(RADIUS_OPTIONS.indexOf(state.discoverRadius) + 1, RADIUS_OPTIONS.length - 1)];
                    if (nextRadius !== state.discoverRadius) handleRadiusSelect(nextRadius);
                  }}
                >
                  <Text style={{ color: "#8B5CF6", fontWeight: "600", fontSize: 14 }}>Expand Range</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item, index }) => <BusinessCard item={item} colors={colors} router={router} index={index} />}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Business Card Component ─────────────────────────────────────────────────

function BusinessCard({ item, colors, router, index }: { item: DiscoverBusiness; colors: ReturnType<typeof useColors>; router: ReturnType<typeof useRouter>; index: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    const delay = index * 60;
    opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
  }, []);

  const tap = Gesture.Tap()
    .onBegin(() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 300 }); })
    .onFinalize((_, success) => {
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (success) {
        if (Platform.OS !== "web") runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(router.push)({ pathname: "/client-business-detail", params: { slug: item.customSlug ?? item.slug } } as any);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const displayCategory = item.businessCategory ?? item.category;
  const accentColor = CATEGORY_COLORS[displayCategory ?? "Other"] ?? "#8B5CF6";
  const distanceMiles = item.distanceKm != null ? kmToMiles(item.distanceKm) : null;

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[animStyle, { marginBottom: 12 }]}>
        <View style={[cardStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Logo / Cover */}
          <View style={[cardStyles.logoBox, { backgroundColor: accentColor + "18" }]}>
            {(item.businessLogoUri || item.logoUrl) ? (
              <Image source={{ uri: item.businessLogoUri ?? item.logoUrl ?? "" }} style={cardStyles.logoImage} resizeMode="cover" />
            ) : (
              <Text style={cardStyles.logoEmoji}>{CATEGORIES.find(c => c.label === (item.businessCategory ?? item.category))?.emoji ?? "🏢"}</Text>
            )}
          </View>

          {/* Info */}
          <View style={cardStyles.info}>
            <Text style={[cardStyles.name, { color: colors.foreground }]} numberOfLines={1}>
              {item.businessName}
            </Text>
            {displayCategory && (
              <View style={[cardStyles.categoryBadge, { backgroundColor: accentColor + "18" }]}>
                <Text style={[cardStyles.categoryBadgeText, { color: accentColor }]}>
                  {CATEGORIES.find(c => c.label === displayCategory)?.emoji ?? ""} {displayCategory}
                </Text>
              </View>
            )}
            {item.address && (
              <Text style={[cardStyles.address, { color: colors.muted }]} numberOfLines={1}>
                📍 {item.address}
              </Text>
            )}
            <View style={cardStyles.meta}>
              {item.avgRating != null && (
                <View style={cardStyles.ratingRow}>
                  <Text style={{ fontSize: 11 }}>⭐</Text>
                  <Text style={[cardStyles.ratingText, { color: colors.foreground }]}>
                    {item.avgRating.toFixed(1)}
                  </Text>
                  <Text style={[cardStyles.reviewCount, { color: colors.muted }]}>
                    ({item.reviewCount})
                  </Text>
                </View>
              )}
              {distanceMiles != null && (
                <Text style={[cardStyles.distance, { color: colors.muted }]}>
                  {distanceMiles < 0.1 ? "< 0.1 mi" : `${distanceMiles.toFixed(1)} mi`}
                </Text>
              )}
            </View>
          </View>

          <IconSymbol name="chevron.right" size={15} color={colors.muted} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  logoEmoji: {
    fontSize: 26,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  address: {
    fontSize: 12,
    marginTop: 1,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
  },
  reviewCount: {
    fontSize: 11,
  },
  distance: {
    fontSize: 12,
  },
});

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    searchRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
      alignItems: "center",
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
    },
    radiusBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    radiusPicker: {
      marginHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      overflow: "hidden",
      marginBottom: 6,
    },
    radiusOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    locationBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
    },
    categoryWrapper: {
      height: 48,
      marginBottom: 4,
    },
    categoryScroll: {
      flexGrow: 0,
    },
    categoryRow: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      gap: 8,
      alignItems: "center",
    },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      height: 34,
    },
    categoryEmoji: {
      fontSize: 13,
      lineHeight: 16,
    },
    categoryLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      paddingTop: 4,
    },
    emptyContainer: {
      alignItems: "center",
      paddingTop: 60,
      gap: 10,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      fontSize: 48,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginTop: 4,
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    expandBtn: {
      marginTop: 8,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: "#8B5CF615",
      borderWidth: 1,
      borderColor: "#8B5CF640",
    },
  });
