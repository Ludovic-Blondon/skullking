import { Pressable, View } from 'react-native';
import { Text } from '@/ui/text';

import { DEFAULT_ROUNDS_PLAN, type Ruleset } from '@/core';
import { useT } from '@/i18n';
import { Stepper } from '@/ui/stepper';

/** Un choix parmi deux ou trois, façon segmenté. */
function Segmented<T extends string | boolean>({
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
  return (
    <View className="gap-2 rounded-field bg-surface-raised p-3">
      <View>
        <Text className="font-semi text-caption text-content">{label}</Text>
        {hint && <Text className="font-body text-micro text-content-muted">{hint}</Text>}
      </View>
      <View className="flex-row gap-1 rounded-full bg-surface-sunken p-1">
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
                selected ? 'bg-primary' : ''
              }`}>
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

/**
 * Options de règles d'une partie (PLAN.md §7.1 : « repliées par défaut »).
 *
 * Un joueur qui découvre l'app ne doit voir que : joueurs → « C'est parti ».
 * Tout ce qui suit est pour la table qui sait ce qu'elle veut — et le barème
 * n'est jamais décrit ici, il vit dans le `Ruleset` que le moteur reçoit (§4.3).
 */
export function RulesetOptions({
  ruleset,
  onChange,
}: {
  ruleset: Ruleset;
  onChange: (ruleset: Ruleset) => void;
}) {
  const t = useT();
  const patch = (values: Partial<Ruleset>) => onChange({ ...ruleset, ...values });
  const rounds = ruleset.roundsPlan.length;

  return (
    <View className="gap-2">
      <Segmented
        label={t('rules.scoring')}
        hint={t(
          ruleset.scoring === 'classic' ? 'rules.scoringClassicHint' : 'rules.scoringRascalHint',
        )}
        value={ruleset.scoring}
        options={[
          { value: 'classic', label: t('rules.classic') },
          { value: 'rascal', label: t('rules.rascal') },
        ]}
        onChange={(scoring) =>
          // Le Boulet de canon n'existe que dans le décompte Rascal : revenir au
          // classique l'éteint plutôt que de le laisser armé en sourdine.
          patch({ scoring, rascalCannonball: scoring === 'rascal' && ruleset.rascalCannonball })
        }
      />

      {ruleset.scoring === 'rascal' && (
        <Segmented
          label={t('rules.cannonball')}
          hint={t('rules.cannonballHint')}
          value={ruleset.rascalCannonball}
          options={[
            { value: false, label: t('rules.without') },
            { value: true, label: t('rules.with') },
          ]}
          onChange={(rascalCannonball) => patch({ rascalCannonball })}
        />
      )}

      <Segmented
        label={t('rules.powers')}
        hint={t('rules.powersHint')}
        value={ruleset.pirateAbilities}
        options={[
          { value: false, label: t('rules.without') },
          { value: true, label: t('rules.with') },
        ]}
        onChange={(pirateAbilities) => patch({ pirateAbilities })}
      />

      <Segmented
        label={t('rules.advanced')}
        hint={t('rules.advancedHint')}
        value={ruleset.advancedCards}
        options={[
          { value: false, label: t('rules.without') },
          { value: true, label: t('rules.with') },
        ]}
        onChange={(advancedCards) => patch({ advancedCards })}
      />

      <Segmented
        label={t('rules.edition')}
        hint={t(
          ruleset.edition === 'current' ? 'rules.editionCurrentHint' : 'rules.editionLegacyHint',
        )}
        value={ruleset.edition}
        options={[
          { value: 'current', label: t('rules.editionCurrent') },
          { value: 'legacy', label: t('rules.editionLegacy') },
        ]}
        onChange={(edition) => patch({ edition })}
      />

      <View className="min-h-touch flex-row items-center justify-between gap-3 rounded-field bg-surface-raised p-3">
        <View className="flex-1">
          <Text className="font-semi text-caption text-content">{t('rules.rounds')}</Text>
          <Text className="font-body text-micro text-content-muted">{t('rules.roundsHint')}</Text>
        </View>
        <Stepper
          value={rounds}
          onChange={(count) =>
            patch({ roundsPlan: DEFAULT_ROUNDS_PLAN.slice(0, Math.max(count, 1)) })
          }
          min={1}
          max={DEFAULT_ROUNDS_PLAN.length}
          size="sm"
          label={t('rules.rounds')}
        />
      </View>
    </View>
  );
}
