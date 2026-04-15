import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "services" | "products";

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

  // ── Helpers ─────────────────────────────────────────────────────────────────

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

  // ── Rename service category ──────────────────────────────────────────────────

  const renameServiceCategory = useCallback((oldName: string) => {
    Alert.prompt(
      "Rename Category",
      `Rename "${oldName}" to:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rename",
            onPress: (newName?: string) => {
              if (!newName?.trim() || newName.trim() === oldName) return;
              const trimmed = newName.trim();
              // Update all services with this category
              state.services.forEach((s) => {
              if (s.category?.trim() === oldName) {
                const action = { type: "UPDATE_SERVICE" as const, payload: { ...s, category: trimmed } };
                dispatch(action);
                syncToDb(action);
              }
            });
          },
        },
      ],
      "plain-text",
      oldName
    );
  }, [state.services, dispatch, syncToDb]);

  // ── Rename product category ──────────────────────────────────────────────────

  const renameProductCategory = useCallback((oldName: string) => {
    Alert.prompt(
      "Rename Category",
      `Rename "${oldName}" to:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rename",
            onPress: (newName?: string) => {
              if (!newName?.trim() || newName.trim() === oldName) return;
              const trimmed = newName.trim();
              state.products.forEach((p) => {
                if (p.category?.trim() === oldName) {
                const action = { type: "UPDATE_PRODUCT" as const, payload: { ...p, category: trimmed } };
                dispatch(action);
                syncToDb(action);
              }
            });
          },
        },
      ],
      "plain-text",
      oldName
    );
  }, [state.products, dispatch, syncToDb]);

  // ── Rename product brand ─────────────────────────────────────────────────────

  const renameProductBrand = useCallback((oldName: string) => {
    Alert.prompt(
      "Rename Brand",
      `Rename "${oldName}" to:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rename",
            onPress: (newName?: string) => {
              if (!newName?.trim() || newName.trim() === oldName) return;
              const trimmed = newName.trim();
              state.products.forEach((p) => {
                if (p.brand?.trim() === oldName) {
                const action = { type: "UPDATE_PRODUCT" as const, payload: { ...p, brand: trimmed } };
                dispatch(action);
                syncToDb(action);
              }
            });
          },
        },
      ],
      "plain-text",
      oldName
    );
  }, [state.products, dispatch, syncToDb]);

  // ── Delete service category (clears category field on all services) ──────────

  const deleteServiceCategory = useCallback((catName: string) => {
    const count = serviceCountForCategory(catName);
    Alert.alert(
      "Remove Category",
      `Remove "${catName}"? The ${count} service${count !== 1 ? "s" : ""} in this category will become uncategorized.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            state.services.forEach((s) => {
              if (s.category?.trim() === catName) {
                const action = { type: "UPDATE_SERVICE" as const, payload: { ...s, category: "" } };
                dispatch(action);
                syncToDb(action);
              }
            });
          },
        },
      ]
    );
  }, [state.services, serviceCountForCategory, dispatch, syncToDb]);

  // ── Delete product category ──────────────────────────────────────────────────

  const deleteProductCategory = useCallback((catName: string) => {
    const count = productCountForCategory(catName);
    Alert.alert(
      "Remove Category",
      `Remove "${catName}"? The ${count} product${count !== 1 ? "s" : ""} in this category will become uncategorized.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            state.products.forEach((p) => {
              if (p.category?.trim() === catName) {
                const action = { type: "UPDATE_PRODUCT" as const, payload: { ...p, category: "" } };
                dispatch(action);
                syncToDb(action);
              }
            });
          },
        },
      ]
    );
  }, [state.products, productCountForCategory, dispatch, syncToDb]);

  // ── Delete product brand ─────────────────────────────────────────────────────

  const deleteProductBrand = useCallback((brandName: string) => {
    const count = productCountForBrand(brandName);
    Alert.alert(
      "Remove Brand",
      `Remove "${brandName}"? The ${count} product${count !== 1 ? "s" : ""} with this brand will become unbranded.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            state.products.forEach((p) => {
              if (p.brand?.trim() === brandName) {
                const action = { type: "UPDATE_PRODUCT" as const, payload: { ...p, brand: "" } };
                dispatch(action);
                syncToDb(action);
              }
            });
          },
        },
      ]
    );
  }, [state.products, productCountForBrand, dispatch, syncToDb]);

  // ── Add new service category ─────────────────────────────────────────────────
  // Note: Adding a category here just validates the name; services must be
  // assigned to it via the service form. This is intentional — categories are
  // derived from service data, not stored separately.

  const handleAddServiceCategory = useCallback(() => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (serviceCategories.includes(name)) {
      Alert.alert("Already Exists", `The category "${name}" already exists.`);
      return;
    }
    // Create a placeholder note — real assignment happens in service form
    Alert.alert(
      "Category Added",
      `"${name}" is ready to use. Assign services to it by editing each service and setting its category to "${name}".`,
      [{ text: "OK" }]
    );
    setNewCategoryName("");
  }, [newCategoryName, serviceCategories]);

  const handleAddProductCategory = useCallback(() => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (productCategories.includes(name)) {
      Alert.alert("Already Exists", `The category "${name}" already exists.`);
      return;
    }
    Alert.alert(
      "Category Added",
      `"${name}" is ready to use. Assign products to it by editing each product and setting its category to "${name}".`,
      [{ text: "OK" }]
    );
    setNewCategoryName("");
  }, [newCategoryName, productCategories]);

  const handleAddProductBrand = useCallback(() => {
    const name = newBrandName.trim();
    if (!name) return;
    if (productBrands.includes(name)) {
      Alert.alert("Already Exists", `The brand "${name}" already exists.`);
      return;
    }
    Alert.alert(
      "Brand Added",
      `"${name}" is ready to use. Assign products to it by editing each product and setting its brand to "${name}".`,
      [{ text: "OK" }]
    );
    setNewBrandName("");
  }, [newBrandName, productBrands]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderCategoryRow = ({
    item,
    count,
    onRename,
    onDelete,
    label = "category",
  }: {
    item: string;
    count: number;
    onRename: (name: string) => void;
    onDelete: (name: string) => void;
    label?: string;
  }) => (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowLeft}>
        <IconSymbol name="tag.fill" size={16} color={colors.primary} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground }}>{item}</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
            {count} {label === "brand" ? "product" : label === "category" ? "item" : "item"}{count !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          onPress={() => onRename(item)}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary + "15", opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="pencil" size={14} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(item)}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.error + "15", opacity: pressed ? 0.6 : 1, marginLeft: 8 }]}
        >
          <IconSymbol name="trash.fill" size={14} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={28} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Categories</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(["services", "products"] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text style={{ fontSize: 14, fontWeight: activeTab === tab ? "600" : "400", color: activeTab === tab ? colors.primary : colors.muted }}>
              {tab === "services" ? "Services" : "Products"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {activeTab === "services" ? (
          <>
            {/* Service Categories */}
            <Text style={[styles.sectionHeader, { color: colors.muted }]}>Service Categories</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 17 }}>
              Categories group your services on the booking page. Assign a category to each service in the service form.
            </Text>

            {serviceCategories.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="tag.fill" size={28} color={colors.muted} />
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8, textAlign: "center" }}>
                  No service categories yet.{"\n"}Add one below or assign categories in the service form.
                </Text>
              </View>
            ) : (
              serviceCategories.map((cat) => (
                <View key={cat}>
                  {renderCategoryRow({
                    item: cat,
                    count: serviceCountForCategory(cat),
                    onRename: renameServiceCategory,
                    onDelete: deleteServiceCategory,
                    label: "service",
                  })}
                </View>
              ))
            )}

            {/* Add new service category */}
            <Text style={[styles.sectionHeader, { color: colors.muted, marginTop: 20 }]}>Add Category</Text>
            <View style={[styles.addRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="e.g. Hair, Nails, Massage"
                placeholderTextColor={colors.muted}
                style={[styles.addInput, { color: colors.foreground }]}
                returnKeyType="done"
                onSubmitEditing={handleAddServiceCategory}
              />
              <Pressable
                onPress={handleAddServiceCategory}
                style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Add</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {/* Product Categories */}
            <Text style={[styles.sectionHeader, { color: colors.muted }]}>Product Categories</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 17 }}>
              Categories group your products on the services page. Assign a category to each product in the product form.
            </Text>

            {productCategories.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="tag.fill" size={28} color={colors.muted} />
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8, textAlign: "center" }}>
                  No product categories yet.
                </Text>
              </View>
            ) : (
              productCategories.map((cat) => (
                <View key={cat}>
                  {renderCategoryRow({
                    item: cat,
                    count: productCountForCategory(cat),
                    onRename: renameProductCategory,
                    onDelete: deleteProductCategory,
                    label: "product",
                  })}
                </View>
              ))
            )}

            {/* Add new product category */}
            <Text style={[styles.sectionHeader, { color: colors.muted, marginTop: 20 }]}>Add Category</Text>
            <View style={[styles.addRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="e.g. Skincare, Hair Care"
                placeholderTextColor={colors.muted}
                style={[styles.addInput, { color: colors.foreground }]}
                returnKeyType="done"
                onSubmitEditing={handleAddProductCategory}
              />
              <Pressable
                onPress={handleAddProductCategory}
                style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Add</Text>
              </Pressable>
            </View>

            {/* Product Brands */}
            <Text style={[styles.sectionHeader, { color: colors.muted, marginTop: 28 }]}>Product Brands</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 17 }}>
              Brands are used to filter products on the services page. Assign a brand to each product in the product form.
            </Text>

            {productBrands.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="tag.fill" size={28} color={colors.muted} />
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8, textAlign: "center" }}>
                  No product brands yet.
                </Text>
              </View>
            ) : (
              productBrands.map((brand) => (
                <View key={brand}>
                  {renderCategoryRow({
                    item: brand,
                    count: productCountForBrand(brand),
                    onRename: renameProductBrand,
                    onDelete: deleteProductBrand,
                    label: "brand",
                  })}
                </View>
              ))
            )}

            {/* Add new brand */}
            <Text style={[styles.sectionHeader, { color: colors.muted, marginTop: 20 }]}>Add Brand</Text>
            <View style={[styles.addRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={newBrandName}
                onChangeText={setNewBrandName}
                placeholder="e.g. Dermalogica, OPI"
                placeholderTextColor={colors.muted}
                style={[styles.addInput, { color: colors.foreground }]}
                returnKeyType="done"
                onSubmitEditing={handleAddProductBrand}
              />
              <Pressable
                onPress={handleAddProductBrand}
                style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Add</Text>
              </Pressable>
            </View>
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
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 10,
  },
  addInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
