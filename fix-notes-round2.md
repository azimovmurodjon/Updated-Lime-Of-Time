# Fix Notes Round 2

## Preview Screenshot
- Onboarding screen now shows 3 progress bars (step 1 active, steps 2 and 3 greyed out)
- The Face ID step (step 3) will appear after login/signup on devices with biometric hardware
- No TypeScript errors, all 154 tests pass
- Dev server running cleanly

## Changes Made
1. Header overlap: Increased paddingTop from 8 to 16 on discounts, gift-cards, and service-form
2. Face ID removed from Settings: Deleted the Security card and useAppLockContext import
3. Face ID added to onboarding: Step 3 with Enable/Skip buttons
4. Face ID logic fixed: Removed AppState listener that caused lock loop, now only locks on cold start
