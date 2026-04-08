import { FlatList, Text, View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function ServicesScreen() {
  const { state } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.max(16, width * 0.05);

  return (
    <ScreenContainer className="pt-2" style={{ paddingHorizontal: hp }}>
      <View style={styles.header}>
        <Text className="text-2xl font-bold text-foreground">Services</Text>
        <Pressable
          onPress={() => router.push({ pathname: "/service-form" as any, params: {} })}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <IconSymbol name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <FlatList
        data={state.services}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/service-form" as any, params: { id: item.id } })
            }
            style={({ pressed }) => [
              styles.serviceCard,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.colorBar, { backgroundColor: item.color }]} />
            <View style={styles.cardContent}>
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.metaRow}>
                <IconSymbol name="clock.fill" size={13} color={colors.muted} />
                <Text className="text-xs text-muted" style={{ marginLeft: 4 }}>{item.duration} min</Text>
                <Text className="text-xs text-muted" style={{ marginHorizontal: 8 }}>·</Text>
                <Text className="text-sm font-semibold" style={{ color: colors.primary }}>${item.price}</Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} style={{ marginRight: 14 }} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="list.bullet" size={48} color={colors.muted} />
            <Text className="text-base text-muted" style={{ marginTop: 12 }}>No services yet</Text>
            <Text className="text-sm text-muted" style={{ marginTop: 4 }}>Tap + to create your first service</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
});
