import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { useTokens } from './use-tokens';

type StepperProps = {
  /** `null` : rien n'est encore saisi — le premier geste tranche. */
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  /** Libellé lu par les lecteurs d'écran (« Annonce de Chloé »). */
  label: string;
  testID?: string;
};

/**
 * Compteur ±, gros et utilisable d'une main autour de la table.
 * Cibles tactiles ≥ 44 pt (PLAN.md §12.10), aucun clavier.
 *
 * Sur une valeur non saisie, « − » pose directement le minimum et « + » la
 * première unité : annoncer 0 coûte un seul geste, comme annoncer 1.
 */
export function Stepper({ value, onChange, min = 0, max, label, testID }: StepperProps) {
  const t = useTokens();

  function step(delta: number) {
    if (value === null) {
      onChange(delta > 0 ? Math.min(min + 1, max) : min);
      Haptics.selectionAsync();
      return;
    }
    const next = Math.min(Math.max(value + delta, min), max);
    if (next === value) return;
    Haptics.selectionAsync();
    onChange(next);
  }

  const disabledMinus = value !== null && value <= min;
  const disabledPlus = value !== null && value >= max;

  return (
    <View className="flex-row items-center gap-1">
      <Pressable
        onPress={() => step(-1)}
        disabled={disabledMinus}
        hitSlop={6}
        testID={testID ? `${testID}-minus` : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${label} : retirer`}
        className="size-touch items-center justify-center rounded-l-card border border-border bg-surface-sunken active:opacity-60">
        <Ionicons name="remove" size={22} color={disabledMinus ? t.borderStrong : t.content} />
      </Pressable>

      <View className="min-w-touch items-center justify-center px-1">
        <Text
          testID={testID}
          className={`text-2xl font-bold tabular-nums ${
            value === null ? 'text-content-muted' : 'text-content'
          }`}>
          {value === null ? '–' : value}
        </Text>
      </View>

      <Pressable
        onPress={() => step(1)}
        disabled={disabledPlus}
        hitSlop={6}
        testID={testID ? `${testID}-plus` : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ajouter`}
        className="size-touch items-center justify-center rounded-r-card border border-border bg-surface-sunken active:opacity-60">
        <Ionicons name="add" size={22} color={disabledPlus ? t.borderStrong : t.content} />
      </Pressable>
    </View>
  );
}
