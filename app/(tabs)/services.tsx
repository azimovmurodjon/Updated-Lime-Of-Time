import { FlatList, Text, View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function ServicesScreen() {
  const { state } = useStore();
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer className="px-5 pt-2">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-bold text-foreground">Services</Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/service-form" as any,
              params: {},
            })
          }
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
              router.push({
                pathname: "/service-form" as any,
                params: { id: item.id },
              })
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
              <View className="flex-row items-center mt-1">
                <IconSymbol name="clock.fill" size={13} color={colors.muted} />
                <Text className="text-xs text-muted ml-1">{item.duration} min</Text>
                <Text className="text-xs text-muted mx-2">·</Text>
                <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                  ${item.price}
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="list.bullet" size={48} color={colors.muted} />
            <Text className="text-base text-muted mt-3">No services yet</Text>
            <Text className="text-sm text-muted mt-1">Tap + to create your first service</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    padding: 14,
  },
});
