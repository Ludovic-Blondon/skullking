import { Text, View } from 'react-native';

import { useT } from '@/i18n';

import type { PlayerStats } from './compute';

const TRACK_HEIGHT = 64;

/**
 * Précision d'annonce, manche par manche (PLAN.md §8) — le profil que le plan
 * cherche : « solide sur les petites manches, fébrile en fin de partie ».
 *
 * Des colonnes plutôt que la courbe prévue au §8 : une courbe relie ses points,
 * donc affirme une continuité d'une manche à l'autre. Or c'est un taux calculé
 * sur peu de parties — à deux parties, chaque point vaut 0, 50 ou 100 %, et la
 * ligne inventerait une tendance. Les colonnes comparent des magnitudes le long
 * d'un axe ordonné, et laissent visiblement vide une manche jamais jouée.
 *
 * Une seule série : pas de légende, le titre la nomme. La couleur ne porte
 * aucune information à elle seule — le texte sous le graphique dit la même
 * chose en clair.
 */
export function AccuracyBars({ stats }: { stats: PlayerStats }) {
  const t = useT();
  if (stats.rounds === 0) return null;

  const lastRound = Math.max(...stats.byRound.map((bucket) => bucket.roundNumber));
  const columns = Array.from({ length: lastRound }, (_, index) => {
    const bucket = stats.byRound.find((entry) => entry.roundNumber === index + 1);
    return {
      roundNumber: index + 1,
      played: bucket?.played ?? 0,
      accuracy: bucket && bucket.played > 0 ? bucket.exact / bucket.played : null,
    };
  });

  return (
    <View
      className="gap-2 rounded-field bg-surface-raised p-3"
      accessible
      accessibilityLabel={t('stats.accuracyLabel', {
        exact: stats.exactRounds,
        played: stats.rounds,
      })}>
      <Text className="font-semi text-caption text-content">{t('stats.accuracyByRound')}</Text>

      <View className="flex-row items-end gap-2" style={{ height: TRACK_HEIGHT }}>
        {columns.map((column) => (
          <View key={column.roundNumber} className="flex-1 items-center">
            {/* Chaque manche a sa gouttière : une colonne à mi-hauteur se lit
                contre son propre plafond, sans axe ni grille à dessiner. */}
            <View className="w-full max-w-[14px] flex-1 justify-end overflow-hidden rounded bg-border/50">
              {column.accuracy === null ? null : (
                <View
                  className="rounded bg-primary"
                  style={{
                    // Un plancher pour qu'une petite valeur reste visible, mais
                    // jamais sur un vrai zéro : il se lirait comme un succès.
                    height: column.accuracy === 0 ? 0 : Math.max(3, column.accuracy * TRACK_HEIGHT),
                  }}
                />
              )}
            </View>
          </View>
        ))}
      </View>

      <View className="flex-row justify-between">
        <Text className="font-body text-micro text-content-muted">
          {t('stats.roundNumber', { round: 1 })}
        </Text>
        <Text className="font-body text-micro text-content-muted">
          {t('stats.roundNumber', { round: lastRound })}
        </Text>
      </View>

      <Text className="font-body text-micro text-content-muted">
        {t('stats.exactOutOf', {
          count: stats.exactRounds,
          exact: stats.exactRounds,
          played: stats.rounds,
        })}
      </Text>
    </View>
  );
}
