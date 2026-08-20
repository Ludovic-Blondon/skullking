import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { CONTENT_MAX_WIDTH } from '@/ui/screen';

/** Couleur du bandeau : ce que la table doit comprendre en un coup d'œil. */
export type BarTone = 'ok' | 'warn' | 'error';

const TONES: Record<BarTone, { strip: string; text: string; icon: string }> = {
  ok: { strip: 'bg-positive/10', text: 'text-positive', icon: '✓' },
  warn: { strip: 'bg-accent/10', text: 'text-accent', icon: '⚠️' },
  error: { strip: 'bg-negative/10', text: 'text-negative', icon: '⚠️' },
};

type ValidationBarProps = {
  /** Résumé du décompte, affiché en clair (« Σ plis 3 + 1 détruit = 4 »). */
  summary: string;
  /** Le bouton d'action est-il ouvert ? */
  ok: boolean;
  /** Message d'anomalie, quand le compte n'y est pas. */
  problem?: string;
  /** Couleur du bandeau ; forcée au rouge dès qu'un problème est signalé. */
  tone?: BarTone;
  actionLabel: string;
  onAction: () => void;
  onForce?: () => void;
};

/**
 * Barre de validation de la manche (PLAN.md §7.2) : le bouton ne s'active que
 * si le compte est bon, avec une échappatoire « forcer » pour les cas de table
 * insolubles — la manche est alors marquée.
 *
 * Maquette : un bandeau teinté pleine largeur, puis l'action. Le bandeau ne
 * porte jamais de bouton : ce qu'on lit et ce qu'on touche restent séparés.
 */
export function ValidationBar({
  summary,
  ok,
  problem,
  tone = 'ok',
  actionLabel,
  onAction,
  onForce,
}: ValidationBarProps) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { strip, text, icon } = TONES[problem ? 'error' : tone];

  return (
    <View className="bg-surface" style={{ paddingBottom: insets.bottom }}>
      <View className={`flex-row items-center gap-2 px-5 py-2.5 ${strip}`}>
        <Text className="text-caption">{icon}</Text>
        <Text className={`flex-1 font-semi text-caption ${text}`}>{problem ?? summary}</Text>
        {!ok && onForce && (
          <Pressable onPress={onForce} hitSlop={10} accessibilityRole="button">
            <Text className="font-semi text-micro text-content-muted underline">
              {t('game.force')}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ maxWidth: CONTENT_MAX_WIDTH }} className="mx-auto w-full px-5 pb-3 pt-3.5">
        <Pressable
          onPress={onAction}
          disabled={!ok}
          testID="round-action"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          className={`min-h-touch items-center justify-center rounded-card p-4 active:opacity-80 ${
            ok ? 'bg-primary' : 'bg-border'
          }`}>
          <Text className={`font-title text-h2 ${ok ? 'text-primary-fg' : 'text-content-muted'}`}>
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
