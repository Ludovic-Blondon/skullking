import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { useTokens } from '@/ui/use-tokens';

type ValidationBarProps = {
  /** Résumé du décompte des plis, affiché en clair (« 3 + 1 détruit = 4 »). */
  summary: string;
  ok: boolean;
  /** Message d'anomalie, quand le compte n'y est pas. */
  problem?: string;
  actionLabel: string;
  onAction: () => void;
  onForce?: () => void;
};

/**
 * Barre de validation de la manche (PLAN.md §7.2) : le bouton ne s'active que
 * si le compte est bon, avec une échappatoire « forcer » pour les cas de table
 * insolubles — la manche est alors marquée.
 */
export function ValidationBar({
  summary,
  ok,
  problem,
  actionLabel,
  onAction,
  onForce,
}: ValidationBarProps) {
  const t = useTokens();

  return (
    <View className="gap-2 border-t border-border bg-surface-raised p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={ok ? 'checkmark-circle' : 'alert-circle'}
          size={18}
          color={ok ? t.positive : t.accent}
        />
        <Text className={`flex-1 text-sm ${ok ? 'text-content-muted' : 'text-content'}`}>
          {problem ?? summary}
        </Text>
        {!ok && onForce && (
          <Pressable onPress={onForce} hitSlop={8} accessibilityRole="button">
            <Text className="text-sm font-semibold text-accent">Forcer</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={onAction}
        disabled={!ok}
        testID="round-action"
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        className="min-h-touch items-center justify-center rounded-card bg-primary p-3 active:opacity-80 disabled:opacity-40">
        <Text className="text-lg font-semibold text-primary-fg">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
