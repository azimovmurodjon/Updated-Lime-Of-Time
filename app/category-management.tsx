import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FuturisticBackground } from "@/components/futuristic-background";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "services" | "products";

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({
  item,
  count,
  countLabel,
  accentColor,
  onRename,
  onDelete,
  colors,
}: {
  item: string;
  count: number;
  countLabel: string;
  accentColor: string;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[rowStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Color dot */}
      <View style={[rowStyles.dot, { backgroundColor: accentColor + "30" }]}>
        <IconSymbol name="tag.fill" size={14} color={accentColor} />
      </View>

      {/* Name + count */}
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, { color: colors.foreground }]} numberOfLines={1}>
          {item}
        </Text>
        <Text style={[rowStyles.count, { color: colors.muted }]}>
          {count} {countLabel}{count !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Actions */}
      <View style={rowStyles.actions}>
        <Pressable
          onPress={() => onRename(item)}
          style={({ pressed }) => [
            rowStyles.actionBtn,
            { backgroundColor: colors.primary + "18", opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <IconSymbol name="pencil" size={15} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(item)}
          style={({ pressed }) => [
            rowStyles.actionBtn,
            { backgroundColor: colors.error + "18", opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <IconSymbol name="trash.fill" size={15} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  count: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  subtitle,
  colors,
}: {
  icon: string;
  title: string;
  subtitle: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[emptyStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: colors.primary + "15" }]}>
        <IconSymbol name={icon as any} size={26} color={colors.primary} />
      </View>
      <Text style={[emptyStyles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[emptyStyles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    padding: 28,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    gap: 8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 240,
  },
});

// ─── Add Row ──────────────────────────────────────────────────────────────────

function AddRow({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  buttonLabel = "Add",
  colors,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
  buttonLabel?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[addStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[addStyles.input, { color: colors.foreground }]}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <Pressable
        onPress={onSubmit}
        style={({ pressed }) => [
          addStyles.btn,
          { backgroundColor: value.trim() ? colors.primary : colors.muted + "40", opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Text style={[addStyles.btnText, { color: value.trim() ? "#fff" : colors.muted }]}>
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const addStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, count, colors }: { label: string; count?: number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, marginTop: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.muted, flex: 1 }}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={{ backgroundColor: colors.primary + "20", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CategoryManagementScreen() {
  const router = useRouter();
  const colors = useColors();
  const { state, dispatch, syncToDb } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");

  // ── Derived data ────────────────────────────────────────────────────────────

  const serviceCategories = useMemo(() => {
    const cats = new Set<string>();
    state.services.forEach((s) => { if (s.category?.trim()) cats.add(s.category.trim()); });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [state.services]);

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    state.products.forEach((p) => { if (p.category?.trim()) cats.add(p.category.trim()); });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [state.products]);

  const productBrands = useMemo(() => {
    const brands = new Set<string>();
    state.products.forEach((p) => { if (p.brand?.trim()) brands.add(p.brand.trim()); });
    return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }, [state.products]);

  const serviceCountForCategory = useCallback((cat: string) =>
    state.services.filter((s) => s.category?.trim() === cat).length,
    [state.services]
  );

  const productCountForCategory = useCallback((cat: string) =>
    state.products.filter((p) => p.category?.trim() === cat).length,
    [state.products]
  );

  const productCountForBrand = useCallback((brand: string) =>
    state.products.filter((p) => p.brand?.trim() === brand).length,
    [state.products]
  );

  // ── Rename / Delete helpers ──────────────────────────────────────────────────

  const renameServiceCategory = useCallback((oldName: string) => {
    Alert.prompt("Rename Category", `Rename "${oldName}" to:`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Rename",
        onPress: (newName?: string) => {
          if (!newName?.trim() || newName.trim() === oldName) return;
          const trimmed = newName.trim();
          state.services.forEach((s) => {
            if (s.category?.trim() === oldName) {
              const action = { type: "UPDATE_SERVICE" as const, payload: { ...s, category: trimmed } };
              dispatch(action); syncToDb(action);
            }
          });
        },
      },
    ], "plain-text", oldName);
  }, [state.services, dispatch, syncToDb]);

  const renameProductCategory = useCallback((oldName: string) => {
    Alert.prompt("Rename Category", `Rename "${oldName}" to:`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Rename",
        onPress: (newName?: string) => {
          if (!newName?.trim() || newName.trim() === oldName) return;
          const trimmed = newName.trim();
          state.products.forEach((p) => {
            if (p.category?.trim() === oldName) {
              const action = { type: "UPDATE_PRODUCT" as const, payload: { ...p, category: trimmed } };
              dispatch(action); syncToDb(action);
            }
          });
        },
      },
    ], "plain-text", oldName);
  }, [state.products, dispatch, syncToDb]);

  const renameProductBrand = useCallback((oldName: string) => {
    Alert.prompt("Rename Brand", `Rename "${oldName}" to:`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Rename",
        onPress: (newName?: string) => {
          if (!newName?.trim() || newName.trim() === oldName) return;
          const trimmed = newName.trim();
          state.products.forEach((p) => {
            if (p.brand?.trim() === oldName) {
              const action = { type: "UPDATE_PRODUCT" as const, payload: { ...p, brand: trimmed } };
              dispatch(action); syncToDb(action);
            }
          });
        },
      },
    ], "plain-text", oldName);
  }, [state.products, dispatch, syncToDb]);

  const deleteServiceCategory = useCallback((catName: string) => {
    const count = serviceCountForCategory(catName);
    Alert.alert("Remove Category", `Remove "${catName}"? The ${count} service${count !== 1 ? "s" : ""} in this category will become uncategorized.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => {
          state.services.forEach((s) => {
            if (s.category?.trim() === catName) {
              const action = { type: "UPDATE_SERVICE" as const, payload: { ...s, category: "" } };
              dispatch(action); syncToDb(action);
            }
          });
        },
      },
    ]);
  }, [state.services, serviceCountForCategory, dispatch, syncToDb]);

  const deleteProductCategory = useCallback((catName: string) => {
    const count = productCountForCategory(catName);
    Alert.alert("Remove Category", `Remove "${catName}"? The ${count} product${count !== 1 ? "s" : ""} in this category will become uncategorized.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => {
          state.products.forEach((p) => {
            if (p.category?.trim() === catName) {
              const action = { type: "UPDATE_PRODUCT" as const, payload: { ...p, category: "" } };
              dispatch(action); syncToDb(action);
            }
          });
        },
      },
    ]);
  }, [state.products, productCountForCategory, dispatch, syncToDb]);

  const deleteProductBrand = useCallback((brandName: string) => {
    const count = productCountForBrand(brandName);
    Alert.alert("Remove Brand", `Remove "${brandName}"? The ${count} product${count !== 1 ? "s" : ""} with this brand will become unbranded.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => {
          state.products.forEach((p) => {
            if (p.brand?.trim() === brandName) {
              const action = { type: "UPDATE_PRODUCT" as const, payload: { ...p, brand: "" } };
              dispatch(action); syncToDb(action);
            }
          });
        },
      },
    ]);
  }, [state.products, productCountForBrand, dispatch, syncToDb]);

  // ── Add handlers ─────────────────────────────────────────────────────────────

  const handleAddServiceCategory = useCallback(() => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (serviceCategories.includes(name)) {
      Alert.alert("Already Exists", `The category "${name}" already exists.`);
      return;
    }
    Alert.alert("Category Added", `"${name}" is ready to use. Assign services to it by editing each service and setting its category to "${name}".`, [{ text: "OK" }]);
    setNewCategoryName("");
  }, [newCategoryName, serviceCategories]);

  const handleAddProductCategory = useCallback(() => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (productCategories.includes(name)) {
      Alert.alert("Already Exists", `The category "${name}" already exists.`);
      return;
    }
    Alert.alert("Category Added", `"${name}" is ready to use. Assign products to it by editing each product and setting its category to "${name}".`, [{ text: "OK" }]);
    setNewCategoryName("");
  }, [newCategoryName, productCategories]);

  const handleAddProductBrand = useCallback(() => {
    const name = newBrandName.trim();
    if (!name) return;
    if (productBrands.includes(name)) {
      Alert.alert("Already Exists", `The brand "${name}" already exists.`);
      return;
    }
    Alert.alert("Brand Added", `"${name}" is ready to use. Assign products to it by editing each product and setting its brand to "${name}".`, [{ text: "OK" }]);
    setNewBrandName("");
  }, [newBrandName, productBrands]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <FuturisticBackground />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={26} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Category Management</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Tab Bar ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(["services", "products"] as Tab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => { setActiveTab(tab); setNewCategoryName(""); }}
              style={[styles.tabBtn, isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <IconSymbol
                  name={tab === "services" ? "sparkles" : "shippingbox.fill"}
                  size={14}
                  color={isActive ? colors.primary : colors.muted}
                />
                <Text style={{ fontSize: 14, fontWeight: isActive ? "700" : "400", color: isActive ? colors.primary : colors.muted }}>
                  {tab === "services" ? "Services" : "Products"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "services" ? (
          <>
            {/* Info banner */}
            <View style={[styles.infoBanner, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
              <IconSymbol name="info.circle.fill" size={15} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.primary, flex: 1, lineHeight: 17 }}>
                Categories group your services on the booking page. Assign a category to each service in the service form.
              </Text>
            </View>

            {/* Categories list */}
            <SectionHeader label="Service Categories" count={serviceCategories.length} colors={colors} />

            {serviceCategories.length === 0 ? (
              <EmptyState
                icon="tag.fill"
                title="No service categories yet"
                subtitle="Add a category below, then assign it to services in the service form."
                colors={colors}
              />
            ) : (
              serviceCategories.map((cat) => (
                <CategoryRow
                  key={cat}
                  item={cat}
                  count={serviceCountForCategory(cat)}
                  countLabel="service"
                  accentColor={colors.primary}
                  onRename={renameServiceCategory}
                  onDelete={deleteServiceCategory}
                  colors={colors}
                />
              ))
            )}

            {/* Add category */}
            <SectionHeader label="Add Category" colors={colors} />
            <AddRow
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="e.g. Hair, Nails, Massage"
              onSubmit={handleAddServiceCategory}
              colors={colors}
            />
          </>
        ) : (
          <>
            {/* Info banner */}
            <View style={[styles.infoBanner, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
              <IconSymbol name="info.circle.fill" size={15} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.primary, flex: 1, lineHeight: 17 }}>
                Categories and brands help organise your products. Assign them to each product in the product form.
              </Text>
            </View>

            {/* Product Categories */}
            <SectionHeader label="Product Categories" count={productCategories.length} colors={colors} />

            {productCategories.length === 0 ? (
              <EmptyState
                icon="tag.fill"
                title="No product categories yet"
                subtitle="Add a category below, then assign it to products in the product form."
                colors={colors}
              />
            ) : (
              productCategories.map((cat) => (
                <CategoryRow
                  key={cat}
                  item={cat}
                  count={productCountForCategory(cat)}
                  countLabel="product"
                  accentColor={colors.primary}
                  onRename={renameProductCategory}
                  onDelete={deleteProductCategory}
                  colors={colors}
                />
              ))
            )}

            <SectionHeader label="Add Category" colors={colors} />
            <AddRow
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="e.g. Skincare, Hair Care"
              onSubmit={handleAddProductCategory}
              colors={colors}
            />

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Product Brands */}
            <SectionHeader label="Product Brands" count={productBrands.length} colors={colors} />

            {productBrands.length === 0 ? (
              <EmptyState
                icon="building.2.fill"
                title="No product brands yet"
                subtitle="Add a brand below, then assign it to products in the product form."
                colors={colors}
              />
            ) : (
              productBrands.map((brand) => (
                <CategoryRow
                  key={brand}
                  item={brand}
                  count={productCountForBrand(brand)}
                  countLabel="product"
                  accentColor="#8B5CF6"
                  onRename={renameProductBrand}
                  onDelete={deleteProductBrand}
                  colors={colors}
                />
              ))
            )}

            <SectionHeader label="Add Brand" colors={colors} />
            <AddRow
              value={newBrandName}
              onChangeText={setNewBrandName}
              placeholder="e.g. Dermalogica, OPI"
              onSubmit={handleAddProductBrand}
              buttonLabel="Add"
              colors={colors}
            />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 24,
  },
});
