# Fix Notes

## Screenshot Analysis (IMG_7073.webp)
- The "Edit Service" title text overlaps with the iOS status bar (9:43, 5G+, battery)
- The "X" close button overlaps with "Chrome" text and "<" back button
- The "Save" button is partially hidden behind the battery indicator (68%)
- The header row is too close to the top of the screen - the safe area top edge is not being respected properly
- The content below (Service Name, Duration, etc.) looks fine
- The issue is specifically that the header content is pushed up into the status bar area

## Root Cause
The ScreenContainer uses SafeAreaView with edges=["top", "bottom", "left", "right"], which should handle this.
But the header has `mt-1` which is only 4px - not enough if SafeArea isn't working properly.
The issue might be that the screen is presented as a modal/card and the safe area insets aren't being applied correctly.

## Fix Approach
- Add explicit paddingTop using useSafeAreaInsets() as a fallback
- Increase the top margin of the header to ensure it clears the status bar
