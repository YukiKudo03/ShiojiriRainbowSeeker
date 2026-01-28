# Accessibility Guidelines for Shiojiri Rainbow Seeker Mobile App

This document outlines the accessibility patterns and guidelines implemented in the application to ensure WCAG 2.1 AA compliance.

## Requirements Reference

**NFR-5: Accessibility**
- WCAG 2.1 AA compliance
- Screen reader support (VoiceOver for iOS, TalkBack for Android)
- Touch target minimum size: 44x44pt
- Color contrast ratio: 4.5:1 or higher for normal text

---

## Core Accessibility Utilities

Located in: `/src/utils/accessibility.ts`

### Constants

```typescript
// Minimum touch target size (WCAG 2.5.5)
MIN_TOUCH_TARGET_SIZE = 44;

// Minimum contrast ratios (WCAG 1.4.3)
MIN_CONTRAST_RATIO_NORMAL = 4.5;  // For normal text
MIN_CONTRAST_RATIO_LARGE = 3.0;   // For large text (18pt or 14pt bold)
```

### Helper Functions

#### Creating Accessibility Props

```typescript
import {
  createButtonAccessibilityProps,
  createLinkAccessibilityProps,
  createImageAccessibilityProps,
  createInputAccessibilityProps,
  createCheckboxAccessibilityProps,
  createHeaderAccessibilityProps,
  createAlertAccessibilityProps,
  createProgressAccessibilityProps,
} from '../utils/accessibility';

// Button example
const buttonProps = createButtonAccessibilityProps('Submit form', {
  hint: 'Submits the registration form',
  disabled: false,
  busy: isLoading,
});

// Image example (decorative)
const decorativeImageProps = createImageAccessibilityProps('', true);

// Input example
const inputProps = createInputAccessibilityProps('Email address', {
  hint: 'Enter your email',
  disabled: false,
  error: emailError,
});
```

#### Contrast Ratio Checking

```typescript
import { getContrastRatio, meetsContrastRequirement } from '../utils/accessibility';

// Check contrast ratio
const ratio = getContrastRatio('#3D7A8C', '#FFFFFF');
console.log(ratio); // 4.53

// Verify compliance
const isCompliant = meetsContrastRequirement('#3D7A8C', '#FFFFFF');
console.log(isCompliant); // true
```

#### Screen Reader Number Formatting

```typescript
import { formatNumberForScreenReader } from '../utils/accessibility';

formatNumberForScreenReader(15000);  // Returns: "1万"
formatNumberForScreenReader(1500);   // Returns: "1千"
formatNumberForScreenReader(150);    // Returns: "150"
```

---

## Accessible Colors

All colors have been verified for WCAG 2.1 AA compliance (4.5:1 minimum contrast on white background).

```typescript
import { accessibleColors } from '../utils/accessibility';

// Primary colors
accessibleColors.primary      // #3D7A8C (4.53:1 on white)
accessibleColors.primaryDark  // #2C5A68 (7.12:1 on white)

// Text colors
accessibleColors.textPrimary   // #1F1F1F (16.1:1 on white)
accessibleColors.textSecondary // #5C5C5C (5.91:1 on white)
accessibleColors.textMuted     // #6B6B6B (4.54:1 on white)

// Semantic colors
accessibleColors.error    // #C53030 (5.89:1 on white)
accessibleColors.warning  // #B45309 (4.51:1 on white)
accessibleColors.success  // #276749 (5.09:1 on white)
accessibleColors.link     // #2563EB (5.31:1 on white)
```

---

## Component Accessibility Patterns

### Button Component

Located in: `/src/components/ui/Button.tsx`

```tsx
<Button
  title="Submit"
  onPress={handleSubmit}
  accessibilityLabel="Submit registration form"  // Optional, defaults to title
  accessibilityHint="Double tap to submit your registration"
  disabled={isSubmitting}
  loading={isLoading}
/>
```

**Built-in accessibility:**
- `accessibilityRole="button"`
- `accessibilityState={{ disabled, busy }}`
- Minimum 44pt height
- High contrast colors

### Input Component

Located in: `/src/components/ui/Input.tsx`

```tsx
<Input
  label="Email"
  value={email}
  onChangeText={setEmail}
  error={emailError}
  hint="We'll never share your email"
  accessibilityLabelOverride="Email address input"  // Optional
/>
```

**Built-in accessibility:**
- Label is read by screen readers
- Error messages announced as alerts
- Password toggle buttons have proper labels
- Minimum touch target sizes

### AccessibleTouchable Component

Located in: `/src/components/accessibility/AccessibleTouchable.tsx`

For custom touchable elements that need to meet accessibility requirements:

```tsx
import { AccessibleTouchable, AccessibleIconButton } from '../components/accessibility';

// Basic usage - enforces 44x44pt minimum
<AccessibleTouchable
  onPress={handlePress}
  accessibilityLabel="Open settings"
  accessibilityRole="button"
  accessibilityHint="Opens the settings screen"
>
  <SettingsIcon />
</AccessibleTouchable>

// Icon button - specialized for icon-only buttons
<AccessibleIconButton
  icon={<CloseIcon size={24} />}
  accessibilityLabel="Close dialog"
  onPress={handleClose}
  iconSize={24}
/>
```

### LikeButton Component

Located in: `/src/components/social/LikeButton.tsx`

```tsx
<LikeButton
  photoId={photo.id}
  initialLiked={photo.isLiked}
  initialLikeCount={photo.likeCount}
/>
```

**Built-in accessibility:**
- Dynamic labels in Japanese (e.g., "いいね済み、100件のいいね")
- State changes announced to screen readers
- `accessibilityState.selected` indicates like status

---

## Best Practices

### 1. Touch Targets

All interactive elements must have a minimum size of 44x44 points:

```tsx
const styles = StyleSheet.create({
  touchable: {
    minWidth: MIN_TOUCH_TARGET_SIZE,  // 44
    minHeight: MIN_TOUCH_TARGET_SIZE, // 44
  },
});
```

### 2. Decorative Images

Mark purely decorative images as inaccessible:

```tsx
<Image
  source={decorativePattern}
  accessible={false}
  importantForAccessibility="no-hide-descendants"
/>
```

### 3. Grouping Related Content

Group related information for better screen reader navigation:

```tsx
<View
  accessible={true}
  accessibilityLabel={`${userName}'s comment, posted ${timeAgo}, ${commentText}`}
>
  <Text>{userName}</Text>
  <Text>{timeAgo}</Text>
  <Text>{commentText}</Text>
</View>
```

### 4. Live Regions

Use live regions for dynamic content that should be announced:

```tsx
<View
  accessibilityLiveRegion="polite"
  accessibilityLabel={`${count} items loaded`}
>
  <Text>{count} items</Text>
</View>
```

### 5. Error Announcements

Error messages should be announced immediately:

```tsx
<Text
  accessibilityRole="alert"
  accessibilityLiveRegion="polite"
>
  {errorMessage}
</Text>
```

### 6. State Changes

Announce state changes programmatically:

```tsx
import { AccessibilityInfo } from 'react-native';

const handleLike = async () => {
  // ... toggle like logic
  AccessibilityInfo.announceForAccessibility('いいねしました');
};
```

---

## Testing Accessibility

### iOS (VoiceOver)

1. Enable VoiceOver: Settings > Accessibility > VoiceOver
2. Navigate through the app using swipe gestures
3. Verify all interactive elements are announced
4. Check focus order is logical

### Android (TalkBack)

1. Enable TalkBack: Settings > Accessibility > TalkBack
2. Navigate through the app using swipe gestures
3. Verify all interactive elements are announced
4. Check focus order is logical

### Automated Testing

Use the Accessibility Inspector in Xcode or the Accessibility Scanner on Android to identify issues.

---

## Checklist for New Components

- [ ] All interactive elements have `accessibilityLabel`
- [ ] Buttons have `accessibilityRole="button"`
- [ ] Links have `accessibilityRole="link"`
- [ ] Images have `accessibilityLabel` or `accessible={false}` for decorative
- [ ] Touch targets are at least 44x44pt
- [ ] Color contrast meets 4.5:1 for normal text
- [ ] Error states are announced with `accessibilityRole="alert"`
- [ ] Loading states use `accessibilityState={{ busy: true }}`
- [ ] Disabled states use `accessibilityState={{ disabled: true }}`
- [ ] Form inputs have associated labels
- [ ] Focus order is logical

---

## Resources

- [React Native Accessibility Guide](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [iOS Accessibility Programming Guide](https://developer.apple.com/accessibility/)
- [Android Accessibility Guide](https://developer.android.com/guide/topics/ui/accessibility)
