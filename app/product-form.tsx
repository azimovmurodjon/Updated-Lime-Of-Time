import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { Product } from "@/lib/types";

export default function ProductFormScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!params.id;

  const existing = isEditing
    ? state.products.find((p) => p.id === params.id)
    : undefined;

  const [name, setName] = useState(existing?.name ?? "");
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [available, setAvailable] = useState(existing?.available ?? true);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setPrice(String(existing.price));
      setDescription(existing.description);
      setAvailable(existing.available);
    }
  }, [existing?.id]);

  const handleSave = () => {
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
        available,
      };
      dispatch({ type: "UPDATE_PRODUCT", payload: updated });
      syncToDb({ type: "UPDATE_PRODUCT", payload: updated });
    } else {
      const newProduct: Product = {
        id: generateId(),
        name: name.trim(),
        price: parsedPrice,
        description: description.trim(),
        available,
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
    <ScreenContainer edges={["left", "right"]}>
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
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
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
