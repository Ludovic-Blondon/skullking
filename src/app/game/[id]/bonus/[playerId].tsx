import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/text';

import {
  BONUS_POINTS,
  bonusTypesFor,
  RASCAL_POINTS,
  ROUND_BONUS_LIMITS,
  type BonusType,
} from '@/core';
import {
  addLootAlliance,
  removeLootAlliance,
  setCaptureBonus,
  updateEntry,
} from '@/db/repositories/game-repo';
import {
  CAPTURE_LABELS,
  COUNTER_UNITS,
  signedPer,
  signedValue,
} from '@/features/game/bonus-labels';
import { useGame, type SeatedPlayer } from '@/features/game/use-game';
import { useT } from '@/i18n';
import { CONTENT_MAX_WIDTH } from '@/ui/screen';
import { Avatar } from '@/ui/avatar';
import { AnimatedNumber } from '@/ui/animated-number';
import { Stepper } from '@/ui/stepper';

/**
 * Cartes uniques : une pastille qui s'allume, pas un compteur à un cran
 * (PLAN.md §7.3). Tout le reste se compte.
 */
const UNIQUE: BonusType[] = [
  'yellow14',
  'green14',
  'purple14',
  'black14',
  'mermaidCapturesSkullKing',
  'firstMateCaptured',
];

/** Ligne de la feuille : un libellé à gauche, un contrôle à droite. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <View className="min-h-touch flex-row items-center justify-between gap-3 rounded-field bg-surface-raised px-3 py-2">
      {children}
    </View>
  );
}

export default function BonusScreen() {
  const t = useT();
  const { id, playerId } = useLocalSearchParams<{ id: string; playerId: string }>();
  const gameId = Number(id);
  const numericPlayerId = Number(playerId);
  const view = useGame(gameId);

  if (!view.ready || !view.game || !view.current) return <View className="flex-1 bg-surface" />;

  // Les alliances et les plafonds de bonus se jouent entre joueurs assis à
  // cette manche (PLAN.md §7.5).
  const { game, activeSeats: seats, current } = view;
  const { round, bonusEvents: events } = current.stored;
  const scale = BONUS_POINTS[game.ruleset.edition];
  // Les compteurs de l'extension n'apparaissent que si elle est en jeu (§4.6).
  const counted = bonusTypesFor(game.ruleset);
  const toggles = counted.filter((type) => UNIQUE.includes(type));
  const counters = counted.filter((type) => !UNIQUE.includes(type));
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
  // Cette feuille ne s'ouvre qu'en phase Résultats : la manche est en train de
  // se jouer, un compteur de plis jamais touché vaut donc 0 pris — le même
  // 0 que la validation écrira. Sans cela, une mise 0 tenue passerait pour
  // ratée et ses bonus s'afficheraient barrés à tort (§4.2).
  const exact = (entry.tricks ?? 0) === effectiveBid;

  const myAllies = events
    .filter((event) => event.playerId === numericPlayerId && event.type === 'loot')
    .map((event) => event.allyPlayerId)
    .filter((allyId): allyId is number => allyId !== null);
  const lootCount = Math.ceil(events.filter((event) => event.type === 'loot').length / 2);

  // Ce que la feuille rapporte à ce joueur, ajustement manuel compris. Les
  // bonus d'une mise ratée restent affichés, mais ne comptent pas (§4.2).
  const captured =
    counted.reduce((sum, type) => {
      const value = scale[type];
      return value === null ? sum : sum + value * countOf(numericPlayerId, type);
    }, 0) +
    myAllies.length * scale.loot;
  const sheetTotal = (exact ? captured : 0) + entry.customBonus;

  return (
    <View className="flex-1 bg-surface">
      {/* Pas d'en-tête natif sur cette feuille : la marge haute dégage la poignée. */}
      <ScrollView
        contentContainerClassName="mx-auto w-full gap-2.5 px-4 pb-8 pt-7"
        contentContainerStyle={{ maxWidth: CONTENT_MAX_WIDTH }}>
        <View className="flex-row items-center gap-2.5">
          <Avatar emoji={player.emoji} color={player.color} size="sm" />
          <Text className="font-title text-h2 text-content">
            {t('bonus.title', { name: player.name })}
          </Text>
        </View>

        {!exact && (
          <View className="flex-row items-center gap-2 rounded-field border border-negative bg-negative/10 px-3 py-2.5">
            <Text className="text-caption">⚠️</Text>
            <Text className="flex-1 font-semi text-caption text-negative">{t('bonus.missed')}</Text>
          </View>
        )}

        <View className="flex-row flex-wrap gap-2">
          {toggles.map((type) => {
            const value = scale[type];
            if (value === null) return null;
            const label = signedValue(value);
            const mine = countOf(numericPlayerId, type) > 0;
            const holder = holderOf(type);
            const locked = !mine && roundTotalOf(type) >= ROUND_BONUS_LIMITS[type];

            return (
              <Pressable
                key={type}
                onPress={() => {
                  void Haptics.selectionAsync();
                  void setCaptureBonus(round.id, numericPlayerId, type, mine ? 0 : 1);
                }}
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
                  {t(CAPTURE_LABELS[type].key)} {t(label.key, { value: label.value })}
                </Text>
                {locked && holder && (
                  <Text className="font-body text-micro text-content-muted">
                    {t('bonus.takenBy', { name: holder.name })}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {counters.map((type) => {
          const value = scale[type];
          if (value === null) return null;
          const per = signedPer(value);
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
                {CAPTURE_LABELS[type].emoji} {t(CAPTURE_LABELS[type].key)}{' '}
                <Text className="font-body text-content-muted">
                  {t(per.key, {
                    value: per.value,
                    unit: COUNTER_UNITS[type] ? t(COUNTER_UNITS[type]) : '',
                  })}
                </Text>
              </Text>
              <Stepper
                value={mine}
                onChange={(count) => void setCaptureBonus(round.id, numericPlayerId, type, count)}
                max={Math.max(0, limit - others)}
                size="sm"
                label={t(CAPTURE_LABELS[type].key)}
              />
            </Row>
          );
        })}

        {game.ruleset.advancedCards && seats.length > 2 && (
          <View className="gap-2 rounded-field bg-surface-raised p-3">
            <Text className="font-semi text-caption text-content">
              💰 {t('bonus.loot')}{' '}
              <Text className="font-body text-content-muted">
                {t('bonus.each', { value: scale.loot })}
              </Text>
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
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: allied, disabled: full }}
                      accessibilityLabel={`${t('bonus.loot')} — ${ally.name}`}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        void (allied
                          ? removeLootAlliance(round.id, numericPlayerId, ally.id)
                          : addLootAlliance(round.id, numericPlayerId, ally.id));
                      }}
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

        {game.ruleset.scoring === 'rascal' && game.ruleset.rascalCannonball && (
          <Row>
            <View className="flex-1">
              <Text className="font-semi text-caption text-content">{t('bonus.cannonball')}</Text>
              <Text className="font-body text-micro text-content-muted">
                {t('bonus.cannonballHint', { value: RASCAL_POINTS.cannonballPerCard })}
              </Text>
            </View>
            <View className="flex-row gap-1.5">
              {([false, true] as const).map((armed) => (
                <Pressable
                  key={String(armed)}
                  onPress={() => void updateEntry(round.id, numericPlayerId, { cannonball: armed })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: entry.cannonball === armed }}
                  accessibilityLabel={t('bonus.cannonballChoice', {
                    state: t(armed ? 'bonus.armed' : 'bonus.notArmed'),
                  })}
                  className={`min-h-9 justify-center rounded-full px-3 active:opacity-70 ${
                    entry.cannonball === armed ? 'bg-primary' : 'bg-surface-sunken'
                  }`}>
                  <Text
                    className={`font-semi text-caption ${
                      entry.cannonball === armed ? 'text-primary-fg' : 'text-content-muted'
                    }`}>
                    {t(armed ? 'bonus.armed' : 'bonus.notArmed')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Row>
        )}

        {game.ruleset.pirateAbilities && (
          <>
            <Row>
              <View className="flex-1">
                <Text className="font-semi text-caption text-content">{t('bonus.harry')}</Text>
                <Text className="font-body text-micro text-content-muted">
                  {entry.bidModifier === 0
                    ? t('bonus.harryUnchanged')
                    : t('bonus.harryShift', { from: entry.bid ?? 0, to: effectiveBid })}
                </Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full bg-surface-sunken p-1">
                {([-1, 0, 1] as const).map((modifier) => (
                  <Pressable
                    key={modifier}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: entry.bidModifier === modifier }}
                    accessibilityLabel={`${t('bonus.harry')} : ${
                      modifier === 0 ? '=' : modifier > 0 ? '+1' : '−1'
                    }`}
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
                <Text className="font-semi text-caption text-content">{t('bonus.rascal')}</Text>
                <Text className="font-body text-micro text-content-muted">
                  {t('bonus.rascalHint')}
                </Text>
              </View>
              <View className="flex-row gap-1.5">
                {([0, 10, 20] as const).map((bet) => (
                  <Pressable
                    key={bet}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: entry.rascalBet === bet }}
                    accessibilityLabel={`${t('bonus.rascal')} : ${
                      bet === 0 ? t('bonus.rascalNone') : bet
                    }`}
                    onPress={() => void updateEntry(round.id, numericPlayerId, { rascalBet: bet })}
                    className={`min-h-9 justify-center rounded-full px-3 active:opacity-70 ${
                      entry.rascalBet === bet ? 'bg-primary' : 'bg-surface-sunken'
                    }`}>
                    <Text
                      className={`font-semi text-caption ${
                        entry.rascalBet === bet ? 'text-primary-fg' : 'text-content-muted'
                      }`}>
                      {bet === 0 ? t('bonus.rascalNone') : bet}
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
              {t('bonus.custom')}{' '}
              <Text className="font-body text-content-muted">{t('bonus.customUnit')}</Text>
            </Text>
            <Text className="font-body text-micro text-content-muted">{t('bonus.customHint')}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() =>
                void updateEntry(round.id, numericPlayerId, {
                  customBonus: entry.customBonus - 5,
                })
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('bonus.remove5')}
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
                  customBonus: entry.customBonus + 5,
                })
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('bonus.add5')}
              className="size-7 items-center justify-center rounded-full bg-primary active:opacity-60">
              <Text className="font-title text-caption text-primary-fg">+</Text>
            </Pressable>
          </View>
        </Row>

        <View className="flex-row items-center justify-between px-1 pt-2">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="font-title text-h2 text-content">{t('bonus.total')}</Text>
            <AnimatedNumber
              value={sheetTotal}
              format={(points) => `${points > 0 ? '+' : ''}${points}`}
              className={`font-title text-h2 ${
                sheetTotal > 0
                  ? 'text-positive'
                  : sheetTotal < 0
                    ? 'text-negative'
                    : 'text-content-muted'
              }`}
            />
          </View>
          {!exact && captured > 0 && (
            <Text className="font-body text-micro text-content-muted">
              {t('bonus.lostToMiss', { points: captured })}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
