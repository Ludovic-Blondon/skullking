import { Pressable, View } from 'react-native';
import { Text } from '@/ui/text';

/**
 * Une préférence : ce qu'elle règle, et deux ou trois valeurs au choix.
 *
 * Même forme que les options de règles d'une partie — un réglage se lit pareil
 * qu'il vaille pour une partie ou pour l'app.
 */
export function PreferenceRow<T extends string | boolean>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  // Au-delà de trois choix — le sélecteur de langue en compte cinq depuis la
  // P7 — les segments passent à la ligne : de front, « Français » ne tient plus.
  const wraps = options.length > 3;
  return (
    <View className="gap-2 rounded-field bg-surface-raised p-3">
      <View>
        <Text className="font-semi text-caption text-content">{label}</Text>
        {hint && <Text className="font-body text-micro text-content-muted">{hint}</Text>}
      </View>
      <View
        className={`flex-row gap-1 bg-surface-sunken p-1 ${
          wraps ? 'flex-wrap rounded-field' : 'rounded-full'
        }`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label} : ${option.label}`}
              className={`min-h-9 flex-1 items-center justify-center rounded-full px-2 active:opacity-70 ${
                wraps ? 'basis-[30%]' : ''
              } ${selected ? 'bg-primary' : ''}`}>
              <Text
                className={`font-semi text-caption ${
                  selected ? 'text-primary-fg' : 'text-content-muted'
                }`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
