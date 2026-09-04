import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/text';

import {
  BASE_POINTS,
  BONUS_POINTS,
  BONUS_TYPES,
  EXPANSION_BONUS_TYPES,
  MAX_DESTROYED_TRICKS,
  RASCAL_BETS,
  RASCAL_POINTS,
  type Edition,
} from '@/core';
import {
  CAPTURE_LABELS,
  COUNTER_UNITS,
  signedPer,
  signedValue,
} from '@/features/game/bonus-labels';
import { useT, type Translate } from '@/i18n';
import { Screen, SectionLabel } from '@/ui/screen';

/** Une ligne du barème : ce qui se passe, ce que ça vaut. */
function Rule({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View className="flex-row items-baseline gap-3 rounded-field bg-surface-raised px-3 py-2.5">
      <View className="flex-1">
        <Text className="font-semi text-caption text-content">{label}</Text>
        {hint && <Text className="font-body text-micro text-content-muted">{hint}</Text>}
      </View>
      <Text className="font-title text-caption tabular-nums text-primary">{value}</Text>
    </View>
  );
}

/** Bonus de capture de l'édition choisie, dans l'ordre de la feuille de saisie. */
function CaptureRules({ edition, t }: { edition: Edition; t: Translate }) {
  const scale = BONUS_POINTS[edition];

  return (
    <View className="gap-2">
      {BONUS_TYPES.map((type) => {
        const value = scale[type];
        return (
          <Rule
            key={type}
            label={`${CAPTURE_LABELS[type].emoji} ${t(CAPTURE_LABELS[type].key)}`}
            value={value === null ? '—' : t('bonus.value', { value })}
            hint={value === null ? t('cheat.notInEdition') : undefined}
          />
        );
      })}
      <Rule
        label={`💰 ${t('bonus.loot')}`}
        value={t('cheat.eachAlly', { value: scale.loot })}
        hint={t('cheat.bothExact')}
      />
    </View>
  );
}

/**
 * Bonus de l'extension officielle (PLAN.md §4.6), qui s'ajoutent au barème de
 * l'édition sans le remplacer — d'où une section à part plutôt qu'un troisième
 * onglet à côté de « 2021+ » et « Ancienne ».
 */
function ExpansionRules({ edition, t }: { edition: Edition; t: Translate }) {
  const scale = BONUS_POINTS[edition];

  return (
    <View className="gap-2">
      {EXPANSION_BONUS_TYPES.map((type) => {
        const value = scale[type];
        if (value === null) return null;
        const unit = COUNTER_UNITS[type];
        // Un compteur s'annonce « +20/léviathan », une carte unique « +30 ».
        const label = unit ? signedPer(value) : signedValue(value);

        return (
          <Rule
            key={type}
            label={`${CAPTURE_LABELS[type].emoji} ${t(CAPTURE_LABELS[type].key)}`}
            value={t(label.key, { value: label.value, unit: unit ? t(unit) : '' })}
          />
        );
      })}
      <Rule label={`🥏 ${t('cheat.ray')}`} value={t('cheat.rayValue')} />
    </View>
  );
}

/**
 * Aide-mémoire du barème (PLAN.md §7.4, annexe A).
 *
 * Toutes les valeurs viennent des constantes du moteur : cet écran ne recopie
 * rien. Corriger un barème le corrige donc ici aussi, et l'aide-mémoire ne peut
 * pas mentir sur ce que l'app compte réellement.
 */
export default function RulesScreen() {
  const t = useT();
  const [edition, setEdition] = useState<Edition>('current');

  return (
    <Screen edgeToEdgeBottom>
      <Text className="font-body text-caption text-content-muted">{t('cheat.intro')}</Text>

      <SectionLabel>{t('cheat.base')}</SectionLabel>
      <View className="gap-2">
        <Rule
          label={t('cheat.exactBid')}
          value={t('cheat.exactBidValue', { value: BASE_POINTS.perTrickWhenExact })}
        />
        <Rule
          label={t('cheat.missedBid')}
          value={t('cheat.missedBidValue', { value: BASE_POINTS.perTrickOfError })}
          hint={t('cheat.missedBidHint')}
        />
        <Rule
          label={t('cheat.zeroWon')}
          value={t('cheat.zeroWonValue', { value: BASE_POINTS.zeroBidPerCard })}
          hint={t('cheat.zeroHint')}
        />
        <Rule
          label={t('cheat.zeroLost')}
          value={t('cheat.zeroLostValue', { value: BASE_POINTS.zeroBidPerCard })}
        />
      </View>

      <SectionLabel>{t('cheat.bonuses')}</SectionLabel>
      <View className="flex-row gap-1 rounded-full bg-surface-sunken p-1">
        {(['current', 'legacy'] as const).map((option) => (
          <Pressable
            key={option}
            onPress={() => setEdition(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: edition === option }}
            accessibilityLabel={`${t('rules.edition')} : ${t(
              option === 'current' ? 'rules.editionCurrent' : 'rules.editionLegacy',
            )}`}
            className={`min-h-9 flex-1 items-center justify-center rounded-full px-2 active:opacity-70 ${
              edition === option ? 'bg-primary' : ''
            }`}>
            <Text
              className={`font-semi text-caption ${
                edition === option ? 'text-primary-fg' : 'text-content-muted'
              }`}>
              {t(option === 'current' ? 'rules.editionCurrent' : 'rules.editionLegacy')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="font-body text-micro text-content-muted">{t('cheat.bonusCondition')}</Text>
      <CaptureRules edition={edition} t={t} />

      <SectionLabel>{t('cheat.rascal')}</SectionLabel>
      <View className="gap-2">
        <Rule
          label={t('cheat.rascalPotential')}
          value={t('cheat.rascalPotentialValue', { value: RASCAL_POINTS.potentialPerCard })}
        />
        <Rule label={t('cheat.rascalExact')} value={t('cheat.rascalExactValue')} />
        <Rule label={t('cheat.rascalNear')} value={t('cheat.rascalNearValue')} />
        <Rule label={t('cheat.rascalElse')} value={t('cheat.rascalElseValue')} />
        <Rule
          label={t('cheat.rascalCannonball')}
          value={t('cheat.rascalCannonballValue', { value: RASCAL_POINTS.cannonballPerCard })}
        />
      </View>

      <SectionLabel>{t('cheat.powers')}</SectionLabel>
      <View className="gap-2">
        <Rule label={t('cheat.harry')} value={t('cheat.harryValue')} hint={t('cheat.harryHint')} />
        <Rule
          label={t('cheat.rascalBet')}
          value={t('cheat.rascalBetValue', {
            low: RASCAL_BETS[1],
            high: RASCAL_BETS[2],
          })}
          hint={t('cheat.rascalBetHint')}
        />
      </View>

      <SectionLabel>{t('cheat.advanced')}</SectionLabel>
      <View className="gap-2">
        <Rule label={`🐙 ${t('cheat.kraken')}`} value={t('cheat.krakenValue')} />
        <Rule label={`🐋 ${t('cheat.whale')}`} value={t('cheat.whaleValue')} />
      </View>
      <Text className="font-body text-micro text-content-muted">
        {t('cheat.advancedHint')} ({MAX_DESTROYED_TRICKS} max)
      </Text>

      <SectionLabel>{t('cheat.expansion')}</SectionLabel>
      <ExpansionRules edition={edition} t={t} />
      <Text className="font-body text-micro text-content-muted">{t('cheat.expansionHint')}</Text>
    </Screen>
  );
}
