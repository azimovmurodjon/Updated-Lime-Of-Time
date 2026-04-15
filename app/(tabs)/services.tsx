import { useState, useMemo } from "react";
import { FlatList, Text, View, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useResponsive } from "@/hooks/use-responsive";

type Tab = "services" | "products";

export default function ServicesScreen() {
  const { state } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { hp, maxContentWidth } = useResponsive();
  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Derive sorted unique brands from products
  const allBrands = useMemo(() => {
    const brands = new Set<string>();
    state.products.forEach((p) => { if (p.brand) brands.add(p.brand); });
    return Array.from(brands).sort();
  }, [state.products]);

  // Derive sorted unique service categories
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    state.services.forEach((s) => { if (s.category) cats.add(s.category); });
    return Array.from(cats).sort();
  }, [state.services]);

  // Filtered products by selected brand
  const filteredProducts = useMemo(() => {
    if (!selectedBrand) return state.products;
    return state.products.filter((p) => p.brand === selectedBrand);
  }, [state.products, selectedBrand]);

  // Filtered services by selected category
  const filteredServices = useMemo(() => {
    if (!selectedCategory) return state.services;
    return state.services.filter((s) => s.category === selectedCategory);
  }, [state.services, selectedCategory]);

  return (
    <ScreenContainer className="pt-2 flex-1" containerClassName="flex-1" safeAreaClassName="flex-1" tabletMaxWidth={0} style={{ paddingHorizontal: hp }}>
      {/* Header */}
      <View style={styles.header}>
        <Text className="text-2xl font-bold text-foreground">
          {activeTab === "services" ? "Services" : "Products"}
        </Text>
        <Pressable
          onPress={() =>
            router.push(
              activeTab === "services"
                ? ({ pathname: "/service-form" as any, params: {} } as any)
                : ({ pathname: "/product-form" as any, params: {} } as any)
            )
          }
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <IconSymbol name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Segmented Control */}
      <View
        style={[
          styles.segmentContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => setActiveTab("services")}
          style={[
            styles.segmentBtn,
            activeTab === "services" && {
              backgroundColor: colors.primary,
            },
          ]}
        >
          <IconSymbol
            name="list.bullet"
            size={16}
            color={activeTab === "services" ? "#fff" : colors.muted}
          />
          <Text
            style={[
              styles.segmentText,
              {
                color: activeTab === "services" ? "#fff" : colors.muted,
              },
            ]}
          >
            Services
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("products")}
          style={[
            styles.segmentBtn,
            activeTab === "products" && {
              backgroundColor: colors.primary,
            },
          ]}
        >
          <IconSymbol
            name="bag.fill"
            size={16}
            color={activeTab === "products" ? "#fff" : colors.muted}
          />
          <Text
            style={[
              styles.segmentText,
              {
                color: activeTab === "products" ? "#fff" : colors.muted,
              },
            ]}
          >
            Products
          </Text>
        </Pressable>
      </View>

      {/* Services List - grouped by category */}
      {activeTab === "services" && (() => {
        // Category filter chips
        const categoryChips = allCategories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10, gap: 8, flexDirection: "row" }}
            style={{ marginBottom: 4 }}
          >
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={[styles.brandChip, { backgroundColor: !selectedCategory ? colors.primary : colors.surface, borderColor: !selectedCategory ? colors.primary : colors.border }]}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: !selectedCategory ? "#fff" : colors.muted }}>All</Text>
            </Pressable>
            {allCategories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                style={[styles.brandChip, { backgroundColor: selectedCategory === cat ? colors.primary : colors.surface, borderColor: selectedCategory === cat ? colors.primary : colors.border }]}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: selectedCategory === cat ? "#fff" : colors.muted }} numberOfLines={1}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null;

        // Group filteredServices by category
        const grouped: { category: string; services: typeof state.services }[] = [];
        const uncategorized: typeof state.services = [];
        const catMap = new Map<string, typeof state.services>();
        filteredServices.forEach((s) => {
          const cat = s.category || "";
          if (!cat) { uncategorized.push(s); return; }
          if (!catMap.has(cat)) catMap.set(cat, []);
          catMap.get(cat)!.push(s);
        });
        // Sort categories alphabetically
        Array.from(catMap.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, svcs]) => {
          grouped.push({ category: cat, services: svcs });
        });
        if (uncategorized.length > 0) grouped.push({ category: "", services: uncategorized });

        // Build flat list data with section headers
        type ListItem = { type: "header"; category: string; key: string } | { type: "service"; item: typeof state.services[0]; key: string };
        const listData: ListItem[] = [];
        const hasCategories = catMap.size > 0 && !selectedCategory;
        grouped.forEach((g) => {
          if (hasCategories) {
            listData.push({ type: "header", category: g.category || "Uncategorized", key: `header-${g.category || "uncategorized"}` });
          }
          g.services.forEach((s) => listData.push({ type: "service", item: s, key: s.id }));
        });

        return (
          <View style={{ flex: 1 }}>
          {categoryChips}
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: row }) => {
              if (row.type === "header") {
                return (
                  <View style={{ paddingVertical: 8, paddingHorizontal: 4, marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                      {row.category}
                    </Text>
                  </View>
                );
              }
              const svc = row.item;
              return (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/service-form" as any, params: { id: svc.id } })
                  }
                  style={({ pressed }) => [
                    styles.serviceCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={[styles.colorBar, { backgroundColor: svc.color }]} />
                  <View style={styles.cardContent}>
                    <Text
                      className="text-base font-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {svc.name}
                    </Text>
                    <View style={styles.metaRow}>
                      <IconSymbol name="clock.fill" size={13} color={colors.muted} />
                      <Text className="text-xs text-muted" style={{ marginLeft: 4 }}>
                        {svc.duration} min
                      </Text>
                      <Text
                        className="text-xs text-muted"
                        style={{ marginHorizontal: 8 }}
                      >
                        ·
                      </Text>
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.primary }}
                      >
                        ${svc.price}
                      </Text>
                      {svc.category && !hasCategories ? (
                        <>
                          <Text className="text-xs text-muted" style={{ marginHorizontal: 8 }}>·</Text>
                          <Text className="text-xs" style={{ color: colors.muted }}>{svc.category}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 }}>
                    <Pressable
                      onPress={() => router.push({ pathname: "/service-gallery" as any, params: { serviceId: svc.id } })}
                      style={({ pressed }) => ({
                        backgroundColor: colors.primary + "15",
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <IconSymbol name="photo.fill" size={14} color={colors.primary} />
                    </Pressable>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <IconSymbol name="list.bullet" size={48} color={colors.muted} />
                <Text className="text-base text-muted" style={{ marginTop: 12 }}>
                  No services yet
                </Text>
                <Text className="text-sm text-muted" style={{ marginTop: 4 }}>
                  Tap + to create your first service
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 80 }}
          />
          </View>
        );
      })()}

      {/* Products List */}
      {activeTab === "products" && (
        <View style={{ flex: 1 }}>
        {/* Brand filter chips */}
        {allBrands.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10, gap: 8, flexDirection: "row" }}
            style={{ marginBottom: 4 }}
          >
            <Pressable
              onPress={() => setSelectedBrand(null)}
              style={[styles.brandChip, { backgroundColor: !selectedBrand ? colors.primary : colors.surface, borderColor: !selectedBrand ? colors.primary : colors.border }]}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: !selectedBrand ? "#fff" : colors.muted }}>All</Text>
            </Pressable>
            {allBrands.map((brand) => (
              <Pressable
                key={brand}
                onPress={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
                style={[styles.brandChip, { backgroundColor: selectedBrand === brand ? colors.primary : colors.surface, borderColor: selectedBrand === brand ? colors.primary : colors.border }]}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: selectedBrand === brand ? "#fff" : colors.muted }} numberOfLines={1}>{brand}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/product-form" as any, params: { id: item.id } })
              }
              style={({ pressed }) => [
                styles.productCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.productIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <IconSymbol name="bag.fill" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text
                  className="text-base font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <View style={styles.metaRow}>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.primary }}
                  >
                    ${item.price.toFixed(2)}
                  </Text>
                  {!item.available && (
                    <>
                      <Text
                        className="text-xs text-muted"
                        style={{ marginHorizontal: 8 }}
                      >
                        ·
                      </Text>
                      <Text className="text-xs" style={{ color: colors.error }}>
                        Unavailable
                      </Text>
                    </>
                  )}
                </View>
                {item.description ? (
                  <Text
                    className="text-xs text-muted"
                    numberOfLines={1}
                    style={{ marginTop: 2 }}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <IconSymbol
                name="chevron.right"
                size={16}
                color={colors.muted}
                style={{ marginRight: 14 }}
              />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="bag.fill" size={48} color={colors.muted} />
              <Text className="text-base text-muted" style={{ marginTop: 12 }}>
                No products yet
              </Text>
              <Text className="text-sm text-muted" style={{ marginTop: 4 }}>
                Tap + to add your first product
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  colorBar: {
    width: 5,
    alignSelf: "stretch",
  },
  cardContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  productIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  brandChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
});
