import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { DENSE_MAX_SCALE, Text } from '@/ui/text';

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  /** Libellé lu par les lecteurs d'écran (« Annonce de Chloé »). */
  label: string;
  /** `sm` pour les compteurs secondaires (Kraken, bonus, ajustement). */
  size?: 'sm' | 'md';
  testID?: string;
};

const SIZES = {
  sm: { button: 26, glyph: 'text-caption', value: 'text-body', track: 'gap-2 px-1.5 py-1' },
  md: { button: 32, glyph: 'text-h2', value: 'text-h1', track: 'gap-2.5 px-2 py-1.5' },
} as const;

/**
 * Compteur ±, gros et utilisable d'une main autour de la table (PLAN.md §7.2).
 *
 * Le rail creusé et le « + » corail viennent de la maquette : le geste qui fait
 * avancer la manche est le seul élément coloré de la ligne. Les pastilles font
 * moins de 44 pt à l'œil, le `hitSlop` ramène la cible au-dessus (§12.10).
 *
 * Tout part de 0 : autour de la table, on ne touche que ce qui diffère.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  label,
  size = 'md',
  testID,
}: StepperProps) {
  const { button, glyph, value: valueText, track } = SIZES[size];

  function step(delta: number) {
    const next = Math.min(Math.max(value + delta, min), max);
    if (next === value) return;
    Haptics.selectionAsync();
    onChange(next);
  }

  const disabledMinus = value <= min;
  const disabledPlus = value >= max;

  return (
    <View className={`flex-row items-center rounded-full bg-surface-sunken ${track}`}>
      <Pressable
        onPress={() => step(-1)}
        disabled={disabledMinus}
        hitSlop={12}
        testID={testID ? `${testID}-minus` : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${label} : retirer`}
        style={{ width: button, height: button }}
        className={`items-center justify-center rounded-full bg-surface-raised active:opacity-60 dark:bg-border ${
          disabledMinus ? 'opacity-40' : ''
        }`}>
        <Text className={`font-title text-content ${glyph}`}>−</Text>
      </Pressable>

      <Text
        testID={testID}
        maxFontSizeMultiplier={DENSE_MAX_SCALE}
        className={`min-w-6 text-center font-display tabular-nums text-content ${valueText}`}>
        {value}
      </Text>

      <Pressable
        onPress={() => step(1)}
        disabled={disabledPlus}
        hitSlop={12}
        testID={testID ? `${testID}-plus` : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ajouter`}
        style={{ width: button, height: button }}
        className={`items-center justify-center rounded-full bg-primary active:opacity-60 ${
          disabledPlus ? 'opacity-40' : ''
        }`}>
        <Text className={`font-title text-primary-fg ${glyph}`}>+</Text>
      </Pressable>
    </View>
  );
}
