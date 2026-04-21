/**
 * Client Portal — Business Detail Screen
 *
 * Shows business info, services list, staff, hours, reviews, and a Book button.
 * Fetches data from the existing public /api/public/business/:slug endpoint.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Dimensions,
  FlatList,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore, SavedBusiness } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Haptics from "expo-haptics";
import { FuturisticBackground } from "@/components/futuristic-background";

const LIME_GREEN = "#4A7C59";

interface PublicService {
  id: number;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
  category: string | null;
}

interface PublicStaff {
  id: number;
  name: string;
  role: string | null;
  bio: string | null;
}

interface PublicHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface ServicePhoto {
  id: number;
  serviceLocalId: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

interface PublicBusiness {
  id: number;
  slug: string;
  businessName: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  avgRating: number | null;
  reviewCount: number;
  services: PublicService[];
  staff: PublicStaff[];
  hours: PublicHours[];
  reviews: { rating: number; comment: string | null; clientName: string; createdAt: string }[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatPrice(price: number | null): string {
  if (price == null) return "Price varies";
  return `$${price.toFixed(2)}`;
}

export default function ClientBusinessDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { state, apiCall, dispatch } = useClientStore();
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [activeTab, setActiveTab] = useState<"services" | "staff" | "hours" | "reviews" | "gallery">("services");
  const [servicePhotos, setServicePhotos] = useState<ServicePhoto[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const SCREEN_WIDTH = Dimensions.get("window").width;

  const apiBase = getApiBaseUrl();

  useEffect(() => {
    (async () => {
      try {
        const [bizRes, photosRes] = await Promise.all([
          fetch(`${apiBase}/api/public/business/${slug}`),
          fetch(`${apiBase}/api/public/service-photos/${slug}`),
        ]);
        if (bizRes.ok) {
          const data = await bizRes.json() as PublicBusiness;
          setBusiness(data);
        }
        if (photosRes.ok) {
          const photos = await photosRes.json() as ServicePhoto[];
          setServicePhotos(photos);
        }
      } catch (err) {
        console.warn("[BizDetail] fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, apiBase]);

  // Check if already saved
  useEffect(() => {
    if (state.account && business) {
      const saved = state.savedBusinesses.some((s) => s.businessSlug === slug);
      setIsSaved(saved);
    }
  }, [state.savedBusinesses, state.account, business, slug]);

  const handleToggleSave = async () => {
    if (!state.account) {
      router.push("/client-signin" as any);
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSavingToggle(true);
    try {
      if (isSaved) {
        await apiCall(`/api/client/saved-businesses/${slug}`, { method: "DELETE" });
        dispatch({ type: "REMOVE_SAVED_BUSINESS", payload: slug });
        setIsSaved(false);
      } else {
        await apiCall<any>(`/api/client/saved-businesses`, {
          method: "POST",
          body: JSON.stringify({ businessSlug: slug }),
        });
        // Optimistically add to saved list
        const optimisticSaved: SavedBusiness = {
          id: Date.now(),
          businessOwnerId: business?.id ?? 0,
          businessName: business?.businessName ?? "",
          businessSlug: slug,
          businessCategory: business?.category ?? null,
          businessAddress: business?.address ?? null,
          businessPhone: business?.phone ?? null,
          savedAt: new Date().toISOString(),
        };
        dispatch({ type: "ADD_SAVED_BUSINESS", payload: optimisticSaved });
        setIsSaved(true);
      }
    } catch (err) {
      console.warn("[BizDetail] save toggle error:", err);
    } finally {
      setSavingToggle(false);
    }
  };

  const handleBookService = (service: PublicService) => {
    if (!state.account) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to book an appointment.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/client-signin" as any) },
        ]
      );
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/client-booking-wizard",
      params: { slug, serviceId: String(service.id) },
    } as any);
  };

  const s = styles(colors);

  if (loading) {
    return (
      <ScreenContainer>
        <FuturisticBackground />
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </ScreenContainer>
    );
  }

  if (!business) {
    return (
      <ScreenContainer className="px-6">
        <FuturisticBackground />
        <View style={s.loadingContainer}>
          <Text style={{ color: colors.foreground, fontSize: 16 }}>Business not found.</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: "#8B5CF6" }}>Go back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FuturisticBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header Banner */}
        <View style={[s.banner, { backgroundColor: "#8B5CF6" }]}>
          <Pressable
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.7 }]}
            onPress={handleToggleSave}
            disabled={savingToggle}
          >
            <IconSymbol name={isSaved ? "bookmark.fill" : "bookmark"} size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Business Info */}
        <View style={s.infoSection}>
          <View style={[s.logoCircle, { backgroundColor: "#8B5CF620" }]}>
            <IconSymbol name="scissors" size={32} color="#8B5CF6" />
          </View>
          <Text style={[s.bizName, { color: colors.foreground }]}>{business.businessName}</Text>
          {business.category && (
            <Text style={[s.bizCategory, { color: "#8B5CF6" }]}>{business.category}</Text>
          )}
          {business.avgRating != null && (
            <View style={s.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <IconSymbol key={star} name="star.fill" size={14} color={star <= Math.round(Number(business.avgRating)) ? colors.warning : colors.border} />
              ))}
              <Text style={[s.ratingText, { color: colors.muted }]}>
                {business.avgRating.toFixed(1)} ({business.reviewCount} reviews)
              </Text>
            </View>
          )}
          {business.address && (
            <View style={s.metaRow}>
              <IconSymbol name="location.fill" size={13} color={colors.muted} />
              <Text style={[s.metaText, { color: colors.muted }]}>{business.address}</Text>
            </View>
          )}
          {business.phone && (
            <Pressable
              style={({ pressed }) => [s.metaRow, pressed && { opacity: 0.7 }]}
              onPress={() => Linking.openURL(`tel:${business.phone}`)}
            >
              <IconSymbol name="phone.fill" size={13} color={colors.muted} />
              <Text style={[s.metaText, { color: "#8B5CF6" }]}>{business.phone}</Text>
            </Pressable>
          )}
          {business.description && (
            <Text style={[s.description, { color: colors.muted }]}>{business.description}</Text>
          )}
        </View>

        {/* Tab Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabBar, { borderBottomColor: colors.border }]} contentContainerStyle={{ flexDirection: "row" }}>
          {(["services", "staff", "hours", "reviews", ...(servicePhotos.length > 0 ? ["gallery"] : [])] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[s.tab, activeTab === tab && { borderBottomColor: "#8B5CF6", borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[s.tabText, { color: activeTab === tab ? "#8B5CF6" : colors.muted }]}>
                {tab === "gallery" ? `Gallery (${servicePhotos.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Services Tab */}
        {activeTab === "services" && (
          <View style={s.tabContent}>
            {business.services.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.muted }]}>No services listed yet.</Text>
            ) : (
              business.services.map((svc) => (
                <View key={svc.id} style={[s.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={s.serviceInfo}>
                    <Text style={[s.serviceName, { color: colors.foreground }]}>{svc.name}</Text>
                    {svc.description && (
                      <Text style={[s.serviceDesc, { color: colors.muted }]} numberOfLines={2}>{svc.description}</Text>
                    )}
                    <View style={s.serviceMeta}>
                      <Text style={[s.serviceDuration, { color: colors.muted }]}>{svc.duration} min</Text>
                      <Text style={[s.servicePrice, { color: colors.foreground }]}>{formatPrice(svc.price)}</Text>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [s.bookBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                    onPress={() => handleBookService(svc)}
                  >
                    <Text style={s.bookBtnText}>Book</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* Staff Tab */}
        {activeTab === "staff" && (
          <View style={s.tabContent}>
            {business.staff.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.muted }]}>No staff listed.</Text>
            ) : (
              business.staff.map((member) => (
                <View key={member.id} style={[s.staffCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[s.staffAvatar, { backgroundColor: "#8B5CF620" }]}>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: "#8B5CF6" }}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.staffInfo}>
                    <Text style={[s.staffName, { color: colors.foreground }]}>{member.name}</Text>
                    {member.role && <Text style={[s.staffRole, { color: "#8B5CF6" }]}>{member.role}</Text>}
                    {member.bio && <Text style={[s.staffBio, { color: colors.muted }]} numberOfLines={2}>{member.bio}</Text>}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Hours Tab */}
        {activeTab === "hours" && (
          <View style={s.tabContent}>
            {business.hours.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.muted }]}>Hours not available.</Text>
            ) : (
              business.hours
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                .map((h) => (
                  <View key={h.dayOfWeek} style={[s.hoursRow, { borderBottomColor: colors.border }]}>
                    <Text style={[s.hoursDay, { color: colors.foreground }]}>{DAY_NAMES[h.dayOfWeek]}</Text>
                    <Text style={[s.hoursTime, { color: h.isOpen ? colors.foreground : colors.muted }]}>
                      {h.isOpen ? `${h.openTime} – ${h.closeTime}` : "Closed"}
                    </Text>
                  </View>
                ))
            )}
          </View>
        )}

        {/* Gallery Tab */}
        {activeTab === "gallery" && (
          <View style={{ paddingTop: 16 }}>
            {/* Swipeable full-width carousel */}
            <FlatList
              data={servicePhotos}
              keyExtractor={(item) => String(item.id)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setGalleryIndex(idx);
              }}
              renderItem={({ item, index }) => (
                <Pressable
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  onPress={() => { setLightboxIndex(index); setLightboxVisible(true); }}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={{ width: SCREEN_WIDTH, height: 260 }}
                    contentFit="cover"
                    transition={300}
                  />
                  {item.caption ? (
                    <View style={[s.photoCaptionBar, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                      <Text style={s.photoCaptionText}>{item.caption}</Text>
                    </View>
                  ) : null}
                </Pressable>
              )}
            />
            {/* Dot indicators */}
            {servicePhotos.length > 1 && (
              <View style={s.dotRow}>
                {servicePhotos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      { backgroundColor: i === galleryIndex ? "#8B5CF6" : colors.border },
                    ]}
                  />
                ))}
              </View>
            )}
            {/* Thumbnail strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
              {servicePhotos.map((photo, idx) => (
                <Pressable
                  key={photo.id}
                  onPress={() => { setLightboxIndex(idx); setLightboxVisible(true); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Image
                    source={{ uri: photo.url }}
                    style={[
                      s.thumbnail,
                      idx === galleryIndex && { borderColor: "#8B5CF6", borderWidth: 2 },
                    ]}
                    contentFit="cover"
                    transition={200}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Lightbox Modal */}
        <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
          <View style={s.lightboxOverlay}>
            <Pressable style={s.lightboxClose} onPress={() => setLightboxVisible(false)}>
              <IconSymbol name="xmark" size={22} color="#FFFFFF" />
            </Pressable>
            <FlatList
              data={servicePhotos}
              keyExtractor={(item) => String(item.id)}
              horizontal
              pagingEnabled
              initialScrollIndex={lightboxIndex}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH, justifyContent: "center", alignItems: "center" }}>
                  <Image
                    source={{ uri: item.url }}
                    style={{ width: SCREEN_WIDTH, height: 400 }}
                    contentFit="contain"
                    transition={200}
                  />
                  {item.caption ? (
                    <Text style={[s.lightboxCaption, { color: "#FFFFFF" }]}>{item.caption}</Text>
                  ) : null}
                </View>
              )}
            />
          </View>
        </Modal>

        {/* Reviews Tab */}
        {activeTab === "reviews" && (
          <View style={s.tabContent}>
            {business.reviews.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.muted }]}>No reviews yet.</Text>
            ) : (
              business.reviews.map((rev, idx) => (
                <View key={idx} style={[s.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={s.reviewHeader}>
                    <Text style={[s.reviewerName, { color: colors.foreground }]}>{rev.clientName}</Text>
                    <View style={s.reviewStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <IconSymbol key={star} name="star.fill" size={12} color={star <= rev.rating ? colors.warning : colors.border} />
                      ))}
                    </View>
                  </View>
                  {rev.comment && (
                    <Text style={[s.reviewComment, { color: colors.muted }]}>{rev.comment}</Text>
                  )}
                  <Text style={[s.reviewDate, { color: colors.muted }]}>
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky Book Button */}
      <View style={[s.stickyBook, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable
          style={({ pressed }) => [s.stickyBookBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
          onPress={() => {
            if (!state.account) {
              router.push("/client-signin" as any);
              return;
            }
            if (business.services.length > 0) {
              handleBookService(business.services[0]);
            }
          }}
        >
          <IconSymbol name="calendar" size={18} color="#FFFFFF" />
          <Text style={s.stickyBookBtnText}>Book an Appointment</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    banner: {
      height: 140,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
    saveBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
    infoSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, alignItems: "center", gap: 6 },
    logoCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginTop: -36, borderWidth: 3, borderColor: colors.background },
    bizName: { fontSize: 22, fontWeight: "700", textAlign: "center" },
    bizCategory: { fontSize: 13, fontWeight: "600" },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    ratingText: { fontSize: 12, marginLeft: 4 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { fontSize: 13 },
    description: { fontSize: 14, textAlign: "center", lineHeight: 20, marginTop: 4 },
    tabBar: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16 },
    tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabText: { fontSize: 13, fontWeight: "600" },
    tabContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
    emptyText: { textAlign: "center", fontSize: 14, paddingVertical: 24 },
    serviceCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
    serviceInfo: { flex: 1, gap: 4 },
    serviceName: { fontSize: 15, fontWeight: "600" },
    serviceDesc: { fontSize: 12, lineHeight: 17 },
    serviceMeta: { flexDirection: "row", gap: 12 },
    serviceDuration: { fontSize: 12 },
    servicePrice: { fontSize: 13, fontWeight: "700" },
    bookBtn: { backgroundColor: "#8B5CF6", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    bookBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    staffCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
    staffAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    staffInfo: { flex: 1, gap: 3 },
    staffName: { fontSize: 15, fontWeight: "600" },
    staffRole: { fontSize: 12, fontWeight: "600" },
    staffBio: { fontSize: 12, lineHeight: 17 },
    hoursRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
    hoursDay: { fontSize: 14, fontWeight: "600" },
    hoursTime: { fontSize: 14 },
    reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
    reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    reviewerName: { fontSize: 14, fontWeight: "600" },
    reviewStars: { flexDirection: "row", gap: 2 },
    reviewComment: { fontSize: 13, lineHeight: 18 },
    reviewDate: { fontSize: 11 },
    stickyBook: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
    stickyBookBtn: { backgroundColor: "#8B5CF6", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 14 },
    stickyBookBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    // Gallery
    photoCaptionBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 8 },
    photoCaptionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "500" },
    dotRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    thumbnail: { width: 72, height: 72, borderRadius: 10, borderWidth: 0, borderColor: "transparent" },
    // Lightbox
    lightboxOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" },
    lightboxClose: { position: "absolute", top: 56, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
    lightboxCaption: { textAlign: "center", fontSize: 14, marginTop: 12, paddingHorizontal: 24 },
  });
