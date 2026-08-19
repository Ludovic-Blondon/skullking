import { Text, View } from 'react-native';

import { PLAYER_COLORS } from './tokens';

type AvatarProps = {
  emoji?: string | null;
  /** Couleur d'identité du joueur, telle que stockée à sa création. */
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
  sm: { box: 24, font: 12, border: 1.2 },
  md: { box: 38, font: 18, border: 1.5 },
  lg: { box: 56, font: 26, border: 2 },
} as const;

/**
 * Pastille d'identité d'un joueur : emoji cerclé de sa couleur, sur un fond de
 * la même teinte très dilué. C'est le seul endroit où la couleur d'un joueur
 * porte du sens — jamais derrière du texte, pour ne pas dépendre du contraste
 * d'une teinte tirée au sort.
 */
export function Avatar({ emoji, color, size = 'md' }: AvatarProps) {
  const { box, font, border } = SIZES[size];
  const tint = color ?? PLAYER_COLORS[0];

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: box,
        height: box,
        borderWidth: border,
        borderColor: tint,
        // Deux chiffres hexadécimaux d'alpha : la teinte reste lisible sur les
        // deux thèmes sans avoir à la recalculer.
        backgroundColor: `${tint}22`,
      }}>
      <Text style={{ fontSize: font }}>{emoji ?? '🏴‍☠️'}</Text>
    </View>
  );
}
