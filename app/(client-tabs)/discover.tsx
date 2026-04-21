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
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore, DiscoverBusiness } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { getApiBaseUrl } from "@/constants/oauth";

const CATEGORIES = [
  "All", "Hair", "Nails", "Skin", "Massage", "Fitness",
  "Dental", "Medical", "Spa", "Barber", "Tattoo", "Other",
];

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

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
      if (radius) params.set("radius", String(radius));
      const res = await fetch(`${apiBase}/api/client/discover?${params.toString()}`);
      if (res.ok) {
        const data = await res.json() as DiscoverBusiness[];
        setBusinesses(data);
      }
    } catch (err) {
      console.warn("[Discover] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
        return { lat: loc.coords.latitude, lng: loc.coords.longitude };
      } else {
        setLocationError("Location permission denied. Showing all businesses.");
      }
    } catch {
      setLocationError("Could not get location. Showing all businesses.");
    }
    return null;
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => {
      const loc = await requestLocation();
      fetchBusinesses(loc?.lat, loc?.lng, searchQuery, state.discoverCategory, state.discoverRadius);
    })();
  }, []));

  const handleSearch = useCallback(() => {
    fetchBusinesses(userLat ?? undefined, userLng ?? undefined, searchQuery, state.discoverCategory, state.discoverRadius);
  }, [userLat, userLng, searchQuery, state.discoverCategory, state.discoverRadius, fetchBusinesses]);

  const handleCategorySelect = (cat: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newCat = cat === "All" ? null : cat;
    dispatch({ type: "SET_DISCOVER_CATEGORY", payload: newCat });
    fetchBusinesses(userLat ?? undefined, userLng ?? undefined, searchQuery, newCat, state.discoverRadius);
  };

  const handleRadiusSelect = (r: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: "SET_DISCOVER_RADIUS", payload: r });
    setShowRadiusPicker(false);
    fetchBusinesses(userLat ?? undefined, userLng ?? undefined, searchQuery, state.discoverCategory, r);
  };

  const s = styles(colors);
  const activeCategory = state.discoverCategory ?? "All";

  return (
    <ScreenContainer>
      {/* Search Bar */}
      <View style={s.searchRow}>
        <View style={[s.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            placeholder="Search businesses or services..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(""); fetchBusinesses(userLat ?? undefined, userLng ?? undefined, "", state.discoverCategory, state.discoverRadius); }}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
        {/* Radius picker button */}
        <Pressable
          style={({ pressed }) => [s.radiusBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          onPress={() => setShowRadiusPicker((v) => !v)}
        >
          <IconSymbol name="location.fill" size={14} color="#8B5CF6" />
          <Text style={{ color: "#8B5CF6", fontSize: 13, fontWeight: "600" }}>{state.discoverRadius}km</Text>
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
                {r} km
              </Text>
              {state.discoverRadius === r && <IconSymbol name="checkmark" size={14} color="#8B5CF6" />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Location error */}
      {locationError && (
        <View style={[s.locationBanner, { backgroundColor: colors.warning + "20" }]}>
          <IconSymbol name="location.slash.fill" size={14} color={colors.warning} />
          <Text style={{ color: colors.warning, fontSize: 12, flex: 1 }}>{locationError}</Text>
        </View>
      )}

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categoryRow}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={({ pressed }) => [
              s.categoryPill,
              { backgroundColor: activeCategory === cat ? "#8B5CF6" : colors.surface, borderColor: activeCategory === cat ? "#8B5CF6" : colors.border },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => handleCategorySelect(cat)}
          >
            <Text style={{ color: activeCategory === cat ? "#FFFFFF" : colors.foreground, fontSize: 13, fontWeight: "600" }}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <IconSymbol name="safari.fill" size={40} color={colors.muted} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No businesses found</Text>
              <Text style={[s.emptySubtitle, { color: colors.muted }]}>
                Try expanding the radius or changing the category filter.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                s.bizCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/client-business-detail", params: { slug: item.slug } } as any);
              }}
            >
              {/* Logo placeholder */}
              <View style={[s.bizLogo, { backgroundColor: "#8B5CF620" }]}>
                <IconSymbol name="scissors" size={24} color="#8B5CF6" />
              </View>
              <View style={s.bizInfo}>
                <Text style={[s.bizName, { color: colors.foreground }]} numberOfLines={1}>{item.businessName}</Text>
                {item.category && (
                  <Text style={[s.bizCategory, { color: "#8B5CF6" }]}>{item.category}</Text>
                )}
                {item.address && (
                  <Text style={[s.bizAddress, { color: colors.muted }]} numberOfLines={1}>
                    <IconSymbol name="location.fill" size={11} color={colors.muted} /> {item.address}
                  </Text>
                )}
                <View style={s.bizMeta}>
                  {item.avgRating != null && (
                    <View style={s.ratingRow}>
                      <IconSymbol name="star.fill" size={12} color={colors.warning} />
                      <Text style={[s.ratingText, { color: colors.foreground }]}>
                        {item.avgRating.toFixed(1)} ({item.reviewCount})
                      </Text>
                    </View>
                  )}
                  {item.distanceKm != null && (
                    <Text style={[s.distanceText, { color: colors.muted }]}>
                      {item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)}m` : `${item.distanceKm.toFixed(1)}km`} away
                    </Text>
                  )}
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    searchRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
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
      paddingVertical: 10,
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
      paddingVertical: 10,
    },
    radiusPicker: {
      marginHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      overflow: "hidden",
      marginBottom: 8,
    },
    radiusOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    locationBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    categoryRow: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
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
    emptyContainer: {
      alignItems: "center",
      paddingTop: 60,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 260,
    },
    bizCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      gap: 12,
    },
    bizLogo: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    bizInfo: {
      flex: 1,
      gap: 3,
    },
    bizName: {
      fontSize: 15,
      fontWeight: "700",
    },
    bizCategory: {
      fontSize: 12,
      fontWeight: "600",
    },
    bizAddress: {
      fontSize: 12,
    },
    bizMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 2,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    ratingText: {
      fontSize: 12,
      fontWeight: "600",
    },
    distanceText: {
      fontSize: 12,
    },
  });
