import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BONUS_POINTS, ROUND_BONUS_LIMITS, type BonusType } from '@/core';
import {
  addLootAlliance,
  removeLootAlliance,
  setCaptureBonus,
  updateEntry,
} from '@/db/repositories/game-repo';
import { useGame, type SeatedPlayer } from '@/features/game/use-game';
import { Avatar } from '@/ui/avatar';
import { Stepper } from '@/ui/stepper';

/** Libellés de saisie — sémantiques, jamais des points bruts (PLAN.md §7.3). */
const CAPTURE_LABELS: Record<BonusType, { emoji: string; label: string }> = {
  yellow14: { emoji: '🟡', label: '14 jaune' },
  green14: { emoji: '🟢', label: '14 vert' },
  purple14: { emoji: '🟣', label: '14 violet' },
  black14: { emoji: '⚫', label: '14 noir' },
  mermaidCapturesSkullKing: { emoji: '⚔️', label: 'Sirène capture le Skull King' },
  skullKingCapturesPirate: { emoji: '☠️', label: 'Skull King capture des pirates' },
  pirateCapturesMermaid: { emoji: '🧜', label: 'Pirate capture des sirènes' },
};

const TOGGLES: BonusType[] = [
  'yellow14',
  'green14',
  'purple14',
  'black14',
  'mermaidCapturesSkullKing',
];
const COUNTERS: BonusType[] = ['skullKingCapturesPirate', 'pirateCapturesMermaid'];

/**
 * Ce que compte le compteur. La **valeur** vient toujours du barème du
 * `Ruleset` — jamais d'ici (invariant AGENTS.md).
 */
const COUNTER_UNITS: Partial<Record<BonusType, string>> = {
  skullKingCapturesPirate: 'pirate',
  pirateCapturesMermaid: 'sirène',
};

/** Ligne de la feuille : un libellé à gauche, un contrôle à droite. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <View className="min-h-touch flex-row items-center justify-between gap-3 rounded-field bg-surface-raised px-3 py-2">
      {children}
    </View>
  );
}

export default function BonusScreen() {
  const { id, playerId } = useLocalSearchParams<{ id: string; playerId: string }>();
  const gameId = Number(id);
  const numericPlayerId = Number(playerId);
  const view = useGame(gameId);

  if (!view.ready || !view.game || !view.current) return <View className="flex-1 bg-surface" />;

  const { game, seats, current } = view;
  const { round, bonusEvents: events } = current.stored;
  const scale = BONUS_POINTS[game.ruleset.edition];
  const player = seats.find((seat) => seat.id === numericPlayerId);
  const entry = current.stored.entries.find((e) => e.playerId === numericPlayerId);
  if (!player || !entry) return <View className="flex-1 bg-surface" />;

  const countOf = (owner: number, type: BonusType) =>
    events
      .filter((event) => event.playerId === owner && event.type === type)
      .reduce((sum, event) => sum + event.count, 0);

  const roundTotalOf = (type: BonusType) =>
    seats.reduce((sum, seat) => sum + countOf(seat.id, type), 0);

  const holderOf = (type: BonusType): SeatedPlayer | undefined =>
    seats.find((seat) => seat.id !== numericPlayerId && countOf(seat.id, type) > 0);

  const effectiveBid = Math.min(
    Math.max((entry.bid ?? 0) + (game.ruleset.pirateAbilities ? entry.bidModifier : 0), 0),
    round.cardsDealt,
  );
  const exact = entry.tricks !== null && entry.tricks === effectiveBid;

  const myAllies = events
    .filter((event) => event.playerId === numericPlayerId && event.type === 'loot')
    .map((event) => event.allyPlayerId)
    .filter((allyId): allyId is number => allyId !== null);
  const lootCount = Math.ceil(events.filter((event) => event.type === 'loot').length / 2);

  // Ce que la feuille rapporte à ce joueur, ajustement manuel compris. Les
  // bonus d'une mise ratée restent affichés, mais ne comptent pas (§4.2).
  const captured =
    TOGGLES.concat(COUNTERS).reduce((sum, type) => {
      const value = scale[type];
      return value === null ? sum : sum + value * countOf(numericPlayerId, type);
    }, 0) +
    myAllies.length * scale.loot;
  const sheetTotal = (exact ? captured : 0) + entry.customBonus;

  return (
    <View className="flex-1 bg-surface">
      {/* Pas d'en-tête natif sur cette feuille : la marge haute dégage la poignée. */}
      <ScrollView contentContainerClassName="gap-2.5 px-4 pb-8 pt-7">
        <View className="flex-row items-center gap-2.5">
          <Avatar emoji={player.emoji} color={player.color} size="sm" />
          <Text className="font-title text-h2 text-content">Bonus — {player.name}</Text>
        </View>

        {!exact && (
          <View className="flex-row items-center gap-2 rounded-field border border-negative bg-negative/10 px-3 py-2.5">
            <Text className="text-caption">⚠️</Text>
            <Text className="flex-1 font-semi text-caption text-negative">
              Mise ratée — bonus sans effet
            </Text>
          </View>
        )}

        <View className="flex-row flex-wrap gap-2">
          {TOGGLES.map((type) => {
            const value = scale[type];
            if (value === null) return null;
            const mine = countOf(numericPlayerId, type) > 0;
            const holder = holderOf(type);
            const locked = !mine && roundTotalOf(type) >= ROUND_BONUS_LIMITS[type];

            return (
              <Pressable
                key={type}
                onPress={() => void setCaptureBonus(round.id, numericPlayerId, type, mine ? 0 : 1)}
                disabled={locked}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: mine, disabled: locked }}
                className={`min-h-touch flex-row items-center gap-1.5 rounded-full px-3.5 active:opacity-70 ${
                  mine ? 'bg-accent' : 'bg-surface-raised'
                } ${locked ? 'opacity-50' : ''}`}>
                <Text className="text-caption">{CAPTURE_LABELS[type].emoji}</Text>
                <Text
                  className={`font-semi text-caption ${mine ? 'text-accent-fg' : 'text-content'} ${
                    mine && !exact ? 'line-through' : ''
                  }`}>
                  {CAPTURE_LABELS[type].label} +{value}
                </Text>
                {locked && holder && (
                  <Text className="font-body text-micro text-content-muted">· {holder.name}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {COUNTERS.map((type) => {
          const value = scale[type];
          if (value === null) return null;
          const mine = countOf(numericPlayerId, type);
          const others = roundTotalOf(type) - mine;
          // Une sirène qui a pris le Skull King a gagné son pli : elle n'est plus
          // capturable (invariant du moteur, §4.2).
          const limit =
            type === 'pirateCapturesMermaid'
              ? Math.max(0, ROUND_BONUS_LIMITS[type] - roundTotalOf('mermaidCapturesSkullKing'))
              : ROUND_BONUS_LIMITS[type];

          return (
            <Row key={type}>
              <Text className="flex-1 font-semi text-caption text-content">
                {CAPTURE_LABELS[type].emoji} {CAPTURE_LABELS[type].label}{' '}
                <Text className="font-body text-content-muted">
                  +{value}/{COUNTER_UNITS[type]}
                </Text>
              </Text>
              <Stepper
                value={mine}
                onChange={(count) => void setCaptureBonus(round.id, numericPlayerId, type, count)}
                max={Math.max(0, limit - others)}
                size="sm"
                label={CAPTURE_LABELS[type].label}
              />
            </Row>
          );
        })}

        {game.ruleset.advancedCards && seats.length > 2 && (
          <View className="gap-2 rounded-field bg-surface-raised p-3">
            <Text className="font-semi text-caption text-content">
              💰 Butin <Text className="font-body text-content-muted">+{scale.loot} chacun</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {seats
                .filter((seat) => seat.id !== numericPlayerId)
                .map((ally) => {
                  const allied = myAllies.includes(ally.id);
                  const full = !allied && lootCount >= ROUND_BONUS_LIMITS.lootAlliances;
                  return (
                    <Pressable
                      key={ally.id}
                      disabled={full}
                      onPress={() =>
                        void (allied
                          ? removeLootAlliance(round.id, numericPlayerId, ally.id)
                          : addLootAlliance(round.id, numericPlayerId, ally.id))
                      }
                      className={`min-h-touch justify-center rounded-full px-3.5 active:opacity-70 ${
                        allied ? 'bg-accent' : 'bg-surface-sunken'
                      } ${full ? 'opacity-40' : ''}`}>
                      <Text
                        className={`font-semi text-caption ${
                          allied ? 'text-accent-fg' : 'text-content-muted'
                        }`}>
                        {ally.emoji} {ally.name}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        )}

        {game.ruleset.pirateAbilities && (
          <>
            <Row>
              <View className="flex-1">
                <Text className="font-semi text-caption text-content">🏴 Harry le Géant</Text>
                <Text className="font-body text-micro text-content-muted">
                  {entry.bidModifier === 0
                    ? 'Mise inchangée'
                    : `Mise ${entry.bid} → ${effectiveBid}`}
                </Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full bg-surface-sunken p-1">
                {([-1, 0, 1] as const).map((modifier) => (
                  <Pressable
                    key={modifier}
                    onPress={() =>
                      void updateEntry(round.id, numericPlayerId, { bidModifier: modifier })
                    }
                    className={`min-w-9 items-center justify-center rounded-full px-2 py-1.5 active:opacity-70 ${
                      entry.bidModifier === modifier ? 'bg-primary' : ''
                    }`}>
                    <Text
                      className={`font-title text-caption ${
                        entry.bidModifier === modifier ? 'text-primary-fg' : 'text-content-muted'
                      }`}>
                      {modifier === 0 ? '=' : modifier > 0 ? '+1' : '−1'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Row>

            <Row>
              <View className="flex-1">
                <Text className="font-semi text-caption text-content">🎲 Pari de Rascal</Text>
                <Text className="font-body text-micro text-content-muted">
                  Gagné si la mise est exacte, débité sinon
                </Text>
              </View>
              <View className="flex-row gap-1.5">
                {([0, 10, 20] as const).map((bet) => (
                  <Pressable
                    key={bet}
                    onPress={() => void updateEntry(round.id, numericPlayerId, { rascalBet: bet })}
                    className={`min-h-9 justify-center rounded-full px-3 active:opacity-70 ${
                      entry.rascalBet === bet ? 'bg-primary' : 'bg-surface-sunken'
                    }`}>
                    <Text
                      className={`font-semi text-caption ${
                        entry.rascalBet === bet ? 'text-primary-fg' : 'text-content-muted'
                      }`}>
                      {bet === 0 ? 'aucun' : bet}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Row>
          </>
        )}

        <Row>
          <View className="flex-1">
            <Text className="font-semi text-caption text-content">
              ✏️ Ajustement manuel <Text className="font-body text-content-muted">±10</Text>
            </Text>
            <Text className="font-body text-micro text-content-muted">
              Règle maison, cas non couvert
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() =>
                void updateEntry(round.id, numericPlayerId, {
                  customBonus: entry.customBonus - 10,
                })
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Retirer 10 points"
              className="size-7 items-center justify-center rounded-full bg-border active:opacity-60">
              <Text className="font-title text-caption text-content-muted">−</Text>
            </Pressable>
            <Text className="min-w-8 text-center font-display text-body tabular-nums text-content">
              {entry.customBonus > 0 ? '+' : ''}
              {entry.customBonus}
            </Text>
            <Pressable
              onPress={() =>
                void updateEntry(round.id, numericPlayerId, {
                  customBonus: entry.customBonus + 10,
                })
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Ajouter 10 points"
              className="size-7 items-center justify-center rounded-full bg-primary active:opacity-60">
              <Text className="font-title text-caption text-primary-fg">+</Text>
            </Pressable>
          </View>
        </Row>

        <View className="flex-row items-center justify-between px-1 pt-2">
          <Text className="font-title text-h2 text-content">
            Total{' '}
            <Text
              className={
                sheetTotal > 0
                  ? 'text-positive'
                  : sheetTotal < 0
                    ? 'text-negative'
                    : 'text-content-muted'
              }>
              {sheetTotal > 0 ? '+' : ''}
              {sheetTotal}
            </Text>
          </Text>
          {!exact && captured > 0 && (
            <Text className="font-body text-micro text-content-muted">
              {captured} pts annulés par la mise ratée
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
