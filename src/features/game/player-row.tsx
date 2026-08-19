import { Text, View } from 'react-native';

import { Avatar } from '@/ui/avatar';
import { Stepper } from '@/ui/stepper';

import type { SeatedPlayer } from './use-game';

/**
 * Bordure de la carte : l'état de la mise se lit à la couleur du liseré, avant
 * même d'avoir lu le chiffre (maquette « PlayerCard — états »).
 */
export type PlayerRowTone = 'idle' | 'bid' | 'exact' | 'missed';

const TONES: Record<PlayerRowTone, string> = {
  idle: 'border-border',
  bid: 'border-primary/40',
  exact: 'border-positive/50',
  missed: 'border-negative/50',
};

type PlayerRowProps = {
  player: SeatedPlayer;
  value: number;
  onChange: (value: number) => void;
  max: number;
  label: string;
  tone?: PlayerRowTone;
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
  tone = 'idle',
  trailing,
  subtitle,
  testID,
}: PlayerRowProps) {
  return (
    <View
      className={`flex-row items-center gap-3 rounded-card border-[1.5px] bg-surface-raised p-3 ${TONES[tone]}`}>
      <Avatar emoji={player.emoji} color={player.color} />
      <View className="flex-1">
        <Text className="font-semi text-body text-content" numberOfLines={1}>
          {player.name}
        </Text>
        {subtitle}
      </View>
      <Stepper
        value={value}
        onChange={onChange}
        max={max}
        label={`${label} de ${player.name}`}
        testID={testID}
      />
      {trailing}
    </View>
  );
}
