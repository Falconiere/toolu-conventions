// HomeScreen — starter feature screen rendered by the app/index.tsx route.
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme/spacing';

/**
 * Starter home screen. Composes the Text primitive + safe-area insets — replace
 * its body with the app's first real feature. Named export (routes re-export it).
 */
export function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <Text variant="display">Welcome</Text>
      <Text variant="body" color="textMuted">
        Edit this screen in src/features/home/screens/home-screen.tsx.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.sm },
});
