import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "calendar": "calendar-today",
  "person.2.fill": "people",
  "list.bullet": "list",
  "gearshape.fill": "settings",
  "plus": "add",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "xmark": "close",
  "checkmark": "check",
  "clock.fill": "access-time",
  "phone.fill": "phone",
  "envelope.fill": "email",
  "pencil": "edit",
  "trash.fill": "delete",
  "magnifyingglass": "search",
  "note.text": "note",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "person.fill": "person",
  "dollarsign.circle.fill": "attach-money",
  "paintpalette.fill": "palette",
  "bell.fill": "notifications",
  "star.fill": "star",
  "arrow.left": "arrow-back",
  "mappin": "place",
  "globe": "language",
  "message.fill": "message",
  "person.crop.circle.badge.plus": "person-add",
  "chart.bar.fill": "bar-chart",
  "chart.pie.fill": "pie-chart",
  "arrow.up.right": "trending-up",
  "crown.fill": "emoji-events",
  "circle.fill": "circle",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "questionmark.circle.fill": "help",
  "moon.fill": "dark-mode",
  "sun.max.fill": "light-mode",
  "circle.lefthalf.filled": "contrast",
  "photo": "image",
  "doc.text.fill": "description",
  "square.and.arrow.up": "share",
  "arrow.down.doc.fill": "file-download",
  "calendar.badge.clock": "event",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
