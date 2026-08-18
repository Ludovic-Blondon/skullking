import Ionicons from '@expo/vector-icons/Ionicons';
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
import { Stepper } from '@/ui/stepper';
import { useTokens } from '@/ui/use-tokens';

/** Libellés de saisie — sémantiques, jamais des points bruts (PLAN.md §7.3). */
const CAPTURE_LABELS: Record<BonusType, { emoji: string; label: string }> = {
  yellow14: { emoji: '🟡', label: '14 jaune' },
  green14: { emoji: '🟢', label: '14 vert' },
  purple14: { emoji: '🟣', label: '14 violet' },
  black14: { emoji: '⚫', label: '14 noir (atout)' },
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

export default function BonusScreen() {
  const { id, playerId } = useLocalSearchParams<{ id: string; playerId: string }>();
  const gameId = Number(id);
  const numericPlayerId = Number(playerId);
  const view = useGame(gameId);
  const t = useTokens();

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

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-3 p-4 pb-8">
      <View className="flex-row items-center gap-3">
        <Text className="text-3xl">{player.emoji ?? '🏴‍☠️'}</Text>
        <View className="flex-1">
          <Text className="text-xl font-bold text-content">{player.name}</Text>
          <Text className="text-sm text-content-muted">
            Annonce {effectiveBid} · {entry.tricks ?? 0} pli{(entry.tricks ?? 0) > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {!exact && (
        <View className="flex-row items-center gap-2 rounded-card border border-accent bg-accent/10 p-3">
          <Ionicons name="information-circle-outline" size={20} color={t.accent} />
          <Text className="flex-1 text-sm text-content">
            Mise ratée : les bonus sont enregistrés mais sans effet sur le score.
          </Text>
        </View>
      )}

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
            className={`min-h-touch flex-row items-center gap-3 rounded-card border p-3 active:opacity-70 ${
              mine ? 'border-primary bg-primary/10' : 'border-border bg-surface-raised'
            } ${locked ? 'opacity-50' : ''}`}>
            <Text className="text-xl">{CAPTURE_LABELS[type].emoji}</Text>
            <View className="flex-1">
              <Text className="text-base font-semibold text-content">
                {CAPTURE_LABELS[type].label}
              </Text>
              {locked && holder && (
                <Text className="text-sm text-content-muted">Déjà attribué à {holder.name}</Text>
              )}
            </View>
            <Text className={`text-base font-bold ${mine ? 'text-primary' : 'text-content-muted'}`}>
              +{value}
            </Text>
          </Pressable>
        );
      })}

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
          <View
            key={type}
            className="flex-row items-center gap-3 rounded-card border border-border bg-surface-raised p-3">
            <Text className="text-xl">{CAPTURE_LABELS[type].emoji}</Text>
            <View className="flex-1">
              <Text className="text-base font-semibold text-content">
                {CAPTURE_LABELS[type].label}
              </Text>
              <Text className="text-sm text-content-muted">+{value} chacun</Text>
            </View>
            <Stepper
              value={mine}
              onChange={(count) => void setCaptureBonus(round.id, numericPlayerId, type, count)}
              max={Math.max(0, limit - others)}
              label={CAPTURE_LABELS[type].label}
            />
          </View>
        );
      })}

      {game.ruleset.advancedCards && seats.length > 2 && (
        <View className="gap-2 rounded-card border border-border bg-surface-raised p-3">
          <View className="flex-row items-center gap-3">
            <Text className="text-xl">💰</Text>
            <View className="flex-1">
              <Text className="text-base font-semibold text-content">Butin</Text>
              <Text className="text-sm text-content-muted">
                +{scale.loot} chacun, si les deux annonces sont exactes
              </Text>
            </View>
          </View>
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
                    className={`min-h-touch justify-center rounded-full border px-4 active:opacity-70 ${
                      allied ? 'border-accent bg-accent/10' : 'border-border'
                    } ${full ? 'opacity-40' : ''}`}>
                    <Text
                      className={`text-sm font-semibold ${allied ? 'text-accent' : 'text-content'}`}>
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
          <View className="gap-2 rounded-card border border-border bg-surface-raised p-3">
            <View className="flex-row items-center gap-3">
              <Text className="text-xl">🏴</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-content">Harry le Géant</Text>
                <Text className="text-sm text-content-muted">
                  {entry.bidModifier === 0
                    ? 'Mise inchangée'
                    : `Mise ${entry.bid} → ${effectiveBid}`}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              {([-1, 0, 1] as const).map((modifier) => (
                <Pressable
                  key={modifier}
                  onPress={() =>
                    void updateEntry(round.id, numericPlayerId, { bidModifier: modifier })
                  }
                  className={`min-h-touch flex-1 items-center justify-center rounded-card border active:opacity-70 ${
                    entry.bidModifier === modifier
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  }`}>
                  <Text className="text-base font-semibold text-content">
                    {modifier === 0 ? '=' : modifier > 0 ? '+1' : '−1'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-2 rounded-card border border-border bg-surface-raised p-3">
            <View className="flex-row items-center gap-3">
              <Text className="text-xl">🎲</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-content">Pari de Rascal</Text>
                <Text className="text-sm text-content-muted">
                  Gagné si la mise est exacte, débité sinon
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              {([0, 10, 20] as const).map((bet) => (
                <Pressable
                  key={bet}
                  onPress={() => void updateEntry(round.id, numericPlayerId, { rascalBet: bet })}
                  className={`min-h-touch flex-1 items-center justify-center rounded-card border active:opacity-70 ${
                    entry.rascalBet === bet ? 'border-primary bg-primary/10' : 'border-border'
                  }`}>
                  <Text className="text-base font-semibold text-content">
                    {bet === 0 ? 'Aucun' : bet}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      <View className="flex-row items-center gap-3 rounded-card border border-border bg-surface-raised p-3">
        <Text className="text-xl">✏️</Text>
        <View className="flex-1">
          <Text className="text-base font-semibold text-content">Ajustement manuel</Text>
          <Text className="text-sm text-content-muted">Règle maison, cas non couvert</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() =>
              void updateEntry(round.id, numericPlayerId, { customBonus: entry.customBonus - 10 })
            }
            accessibilityLabel="Retirer 10 points"
            className="size-touch items-center justify-center rounded-l-card border border-border bg-surface-sunken active:opacity-60">
            <Ionicons name="remove" size={22} color={t.content} />
          </Pressable>
          <Text className="min-w-touch text-center text-lg font-bold tabular-nums text-content">
            {entry.customBonus > 0 ? '+' : ''}
            {entry.customBonus}
          </Text>
          <Pressable
            onPress={() =>
              void updateEntry(round.id, numericPlayerId, { customBonus: entry.customBonus + 10 })
            }
            accessibilityLabel="Ajouter 10 points"
            className="size-touch items-center justify-center rounded-r-card border border-border bg-surface-sunken active:opacity-60">
            <Ionicons name="add" size={22} color={t.content} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
