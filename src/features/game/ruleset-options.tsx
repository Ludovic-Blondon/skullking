import { Pressable, Text, View } from 'react-native';

import { DEFAULT_ROUNDS_PLAN, type Ruleset } from '@/core';
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
  const patch = (values: Partial<Ruleset>) => onChange({ ...ruleset, ...values });
  const rounds = ruleset.roundsPlan.length;

  return (
    <View className="gap-2">
      <Segmented
        label="Variante de score"
        hint={
          ruleset.scoring === 'classic'
            ? 'Barème du livret : 20 par pli annoncé, ±10 par carte sur une mise 0'
            : 'Rascal le Flambeur : un potentiel par manche, jamais de score négatif'
        }
        value={ruleset.scoring}
        options={[
          { value: 'classic', label: 'Classique' },
          { value: 'rascal', label: 'Rascal' },
        ]}
        onChange={(scoring) =>
          // Le Boulet de canon n'existe que dans le décompte Rascal : revenir au
          // classique l'éteint plutôt que de le laisser armé en sourdine.
          patch({ scoring, rascalCannonball: scoring === 'rascal' && ruleset.rascalCannonball })
        }
      />

      {ruleset.scoring === 'rascal' && (
        <Segmented
          label="Boulet de canon"
          hint="Tout ou rien : le potentiel monte, mais un pli d’écart ne rapporte plus rien"
          value={ruleset.rascalCannonball}
          options={[
            { value: false, label: 'Sans' },
            { value: true, label: 'Avec' },
          ]}
          onChange={(rascalCannonball) => patch({ rascalCannonball })}
        />
      )}

      <Segmented
        label="Pouvoirs des pirates"
        hint="Harry le Géant (mise ±1) et le pari de Rascal (±10 / ±20)"
        value={ruleset.pirateAbilities}
        options={[
          { value: false, label: 'Sans' },
          { value: true, label: 'Avec' },
        ]}
        onChange={(pirateAbilities) => patch({ pirateAbilities })}
      />

      <Segmented
        label="Cartes avancées"
        hint="Kraken, Baleine blanche et Butin"
        value={ruleset.advancedCards}
        options={[
          { value: false, label: 'Sans' },
          { value: true, label: 'Avec' },
        ]}
        onChange={(advancedCards) => patch({ advancedCards })}
      />

      <Segmented
        label="Édition"
        hint={
          ruleset.edition === 'current'
            ? 'Boîte 2021 et suivantes'
            : 'Avant 2021 : Sirène qui capture le Skull King à +50, pas de « Pirate capture Sirène »'
        }
        value={ruleset.edition}
        options={[
          { value: 'current', label: '2021+' },
          { value: 'legacy', label: 'Ancienne' },
        ]}
        onChange={(edition) => patch({ edition })}
      />

      <View className="min-h-touch flex-row items-center justify-between gap-3 rounded-field bg-surface-raised p-3">
        <View className="flex-1">
          <Text className="font-semi text-caption text-content">Nombre de manches</Text>
          <Text className="font-body text-micro text-content-muted">
            La manche N distribue N cartes
          </Text>
        </View>
        <Stepper
          value={rounds}
          onChange={(count) =>
            patch({ roundsPlan: DEFAULT_ROUNDS_PLAN.slice(0, Math.max(count, 1)) })
          }
          min={1}
          max={DEFAULT_ROUNDS_PLAN.length}
          size="sm"
          label="Nombre de manches"
        />
      </View>
    </View>
  );
}
