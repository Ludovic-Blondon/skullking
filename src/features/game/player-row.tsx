import { Text, View } from 'react-native';

import { Stepper } from '@/ui/stepper';

import type { SeatedPlayer } from './use-game';

type PlayerRowProps = {
  player: SeatedPlayer;
  value: number | null;
  onChange: (value: number) => void;
  max: number;
  label: string;
  /** Rendu à droite du compteur : pastille de bonus, mise annoncée… */
  trailing?: React.ReactNode;
  /** Ligne d'information sous le nom (mise annoncée, score courant…). */
  subtitle?: React.ReactNode;
  testID?: string;
};

export function PlayerRow({
  player,
  value,
  onChange,
  max,
  label,
  trailing,
  subtitle,
  testID,
}: PlayerRowProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-card border border-border bg-surface-raised p-3">
      <Text className="text-2xl">{player.emoji ?? '🏴‍☠️'}</Text>
      <View className="flex-1">
        <Text className="text-base font-semibold text-content" numberOfLines={1}>
          {player.name}
        </Text>
        {subtitle}
      </View>
      {trailing}
      <Stepper
        value={value}
        onChange={onChange}
        max={max}
        label={`${label} de ${player.name}`}
        testID={testID}
      />
    </View>
  );
}
