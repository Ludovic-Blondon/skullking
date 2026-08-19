import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

type StepperProps = {
  /** `null` : rien n'est encore saisi — le premier geste tranche. */
  value: number | null;
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
 * Sur une valeur non saisie, « − » pose directement le minimum et « + » la
 * première unité : annoncer 0 coûte un seul geste, comme annoncer 1.
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
        className={`min-w-6 text-center font-display tabular-nums ${valueText} ${
          value === null ? 'text-content-muted' : 'text-content'
        }`}>
        {value === null ? '–' : value}
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
