import { useRef, useCallback } from "react";
import { ScrollView, FlatList } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Returns a ref to attach to a ScrollView or FlatList.
 * Whenever the screen gains focus (tab switch, back navigation, or first visit),
 * the list/scroll automatically resets to the top.
 *
 * Usage:
 * ```tsx
 * const scrollRef = useScrollToTopOnFocus<ScrollView>();
 * <ScrollView ref={scrollRef} ...>
 * ```
 * or for FlatList:
 * ```tsx
 * const listRef = useScrollToTopOnFocus<FlatList>();
 * <FlatList ref={listRef} ...>
 * ```
 */
export function useScrollToTopOnFocus<T extends ScrollView | FlatList<any>>() {
  const ref = useRef<T>(null);

  useFocusEffect(
    useCallback(() => {
      // Small delay to ensure layout is complete before scrolling
      const timer = setTimeout(() => {
        if (ref.current) {
          if ("scrollTo" in ref.current) {
            (ref.current as ScrollView).scrollTo({ y: 0, animated: false });
          } else if ("scrollToOffset" in ref.current) {
            (ref.current as FlatList<any>).scrollToOffset({ offset: 0, animated: false });
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }, [])
  );

  return ref;
}
