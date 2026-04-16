import React, { useState, useEffect } from "react";
import { usePlanLimitCheck } from "@/hooks/use-plan-limit-check";
import { UpgradePlanSheet } from "@/components/upgrade-plan-sheet";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { Product } from "@/lib/types";
import * as ImagePicker from "expo-image-picker";

export default function ProductFormScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTablet, hp } = useResponsive();
  const { checkLimit } = usePlanLimitCheck();
  const [upgradeSheetVisible, setUpgradeSheetVisible] = useState(false);
  const [upgradeSheetInfo, setUpgradeSheetInfo] = useState<{ planKey: string; planName: string; limit: number } | null>(null);
  const params = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!params.id;

  const existing = isEditing
    ? state.products.find((p) => p.id === params.id)
    : undefined;

  const [name, setName] = useState(existing?.name ?? "");
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [available, setAvailable] = useState(existing?.available ?? true);
  const [photoUri, setPhotoUri] = useState<string | undefined>(existing?.photoUri);

  // Collect existing brands for suggestions
  const existingBrands = React.useMemo(() => {
    const brands = new Set<string>();
    state.products.forEach((p) => {
      if (p.brand && p.brand.trim()) brands.add(p.brand.trim());
    });
    return Array.from(brands).sort();
  }, [state.products]);

  // Collect existing categories for suggestions
  const existingCategories = React.useMemo(() => {
    const cats = new Set<string>();
    state.products.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats).sort();
  }, [state.products]);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setPrice(String(existing.price));
      setDescription(existing.description);
      setBrand(existing.brand ?? "");
      setCategory(existing.category ?? "");
      setAvailable(existing.available);
      setPhotoUri(existing.photoUri);
    }
  }, [existing?.id]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to add a product photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    // Check plan limit for new products only
    if (!isEditing) {
      const limitInfo = checkLimit("products");
      if (!limitInfo.allowed) {
        setUpgradeSheetInfo({ planKey: limitInfo.planKey, planName: limitInfo.planName, limit: limitInfo.currentLimit });
        setUpgradeSheetVisible(true);
        return;
      }
    }
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a product name.");
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert("Required", "Please enter a valid price.");
      return;
    }

    if (isEditing && existing) {
      const updated: Product = {
        ...existing,
        name: name.trim(),
        price: parsedPrice,
        description: description.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        available,
        photoUri: photoUri || undefined,
      };
      dispatch({ type: "UPDATE_PRODUCT", payload: updated });
      syncToDb({ type: "UPDATE_PRODUCT", payload: updated });
    } else {
      const newProduct: Product = {
        id: generateId(),
        name: name.trim(),
        price: parsedPrice,
        description: description.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        available,
        photoUri: photoUri || undefined,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_PRODUCT", payload: newProduct });
      syncToDb({ type: "ADD_PRODUCT", payload: newProduct });
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert("Delete Product", `Are you sure you want to delete "${existing.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          dispatch({ type: "DELETE_PRODUCT", payload: existing.id });
          syncToDb({ type: "DELETE_PRODUCT", payload: existing.id });
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["left", "right"]} tabletMaxWidth={680}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: insets.top + 12,
              paddingHorizontal: hp,
            },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <IconSymbol name="xmark" size={22} color={colors.foreground} />
          </Pressable>
          <Text
            className="text-lg font-semibold text-foreground"
            style={{ flex: 1, textAlign: "center" }}
          >
            {isEditing ? "Edit Product" : "New Product"}
          </Text>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: hp, paddingVertical: 20, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <Text className="text-sm font-medium text-muted" style={{ marginBottom: 6 }}>
            Product Name *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Hair Serum, Styling Gel"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            returnKeyType="next"
          />

          {/* Price */}
          <Text
            className="text-sm font-medium text-muted"
            style={{ marginBottom: 6, marginTop: 16 }}
          >
            Price ($) *
          </Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            returnKeyType="done"
          />

          {/* Category */}
          <Text
            className="text-sm font-medium text-muted"
            style={{ marginBottom: 6, marginTop: 16 }}
          >
            Category (optional)
          </Text>
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Hair Care, Styling, Treatment"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            returnKeyType="next"
          />
          {existingCategories.length > 0 && !category && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {existingCategories.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
                    borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 13, color: colors.muted }}>{cat}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Brand */}
          <Text
            className="text-sm font-medium text-muted"
            style={{ marginBottom: 6, marginTop: 16 }}
          >
            Brand
          </Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Olaplex, Redken, Paul Mitchell"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            returnKeyType="next"
          />
          {existingBrands.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {existingBrands.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => setBrand(b)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: brand === b ? colors.primary : colors.border,
                      backgroundColor: brand === b ? colors.primary + "15" : colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13, color: brand === b ? colors.primary : colors.muted }}>
                    {b}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Description */}
          <Text
            className="text-sm font-medium text-muted"
            style={{ marginBottom: 6, marginTop: 16 }}
          >
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Optional product description"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
                minHeight: 80,
                textAlignVertical: "top",
              },
            ]}
          />

          {/* Photo (optional) */}
          <Text className="text-sm font-medium text-muted" style={{ marginBottom: 6, marginTop: 16 }}>
            Product Photo (optional)
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8, lineHeight: 15 }}>
            Shown to clients on the booking page. Helps them identify the product.
          </Text>
          <Pressable
            onPress={pickPhoto}
            style={({ pressed }) => [{
              borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
              overflow: "hidden", marginBottom: photoUri ? 6 : 16, opacity: pressed ? 0.7 : 1,
              backgroundColor: colors.surface, minHeight: 110, alignItems: "center", justifyContent: "center",
            }]}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: "100%", height: 150, borderRadius: 10 }} resizeMode="cover" />
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 22, gap: 6 }}>
                <IconSymbol name="photo.badge.plus" size={28} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.muted }}>Tap to add a photo</Text>
              </View>
            )}
          </Pressable>
          {photoUri && (
            <Pressable
              onPress={() => setPhotoUri(undefined)}
              style={({ pressed }) => [{ alignSelf: "flex-start", marginBottom: 16, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={{ fontSize: 12, color: colors.error }}>Remove photo</Text>
            </Pressable>
          )}

          {/* Available Toggle */}
          <View style={[styles.toggleRow, { marginTop: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text className="text-base font-medium text-foreground">
                Available for Sale
              </Text>
              <Text className="text-xs text-muted" style={{ marginTop: 2 }}>
                Clients can add this product when booking
              </Text>
            </View>
            <Switch
              value={available}
              onValueChange={setAvailable}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {/* Delete Button */}
          {isEditing && (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.deleteBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="trash.fill" size={18} color={colors.error} />
              <Text
                style={{
                  color: colors.error,
                  fontWeight: "600",
                  marginLeft: 8,
                  fontSize: 15,
                }}
              >
                Delete Product
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {upgradeSheetInfo && (
        <UpgradePlanSheet
          visible={upgradeSheetVisible}
          onClose={() => setUpgradeSheetVisible(false)}
          currentPlanKey={upgradeSheetInfo.planKey}
          currentPlanName={upgradeSheetInfo.planName}
          resource="products"
          currentLimit={upgradeSheetInfo.limit}
          businessOwnerId={state.businessOwnerId!}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    paddingVertical: 14,
  },
});
