import type { BonusType } from '@/core';

/**
 * Libellés de bonus — sémantiques, jamais des points bruts (PLAN.md §7.3).
 * Les valeurs, elles, viennent toujours du barème du `Ruleset`.
 *
 * Partagés entre la saisie (bottom sheet de manche) et la lecture (détail
 * d'une partie dans l'historique) : un bonus doit se nommer pareil des deux
 * côtés. Ils partiront dans les fichiers de traduction en P6.
 */
export const CAPTURE_LABELS: Record<BonusType, { emoji: string; label: string }> = {
  yellow14: { emoji: '🟡', label: '14 jaune' },
  green14: { emoji: '🟢', label: '14 vert' },
  purple14: { emoji: '🟣', label: '14 violet' },
  black14: { emoji: '⚫', label: '14 noir' },
  mermaidCapturesSkullKing: { emoji: '⚔️', label: 'Sirène capture le Skull King' },
  skullKingCapturesPirate: { emoji: '☠️', label: 'Skull King capture des pirates' },
  pirateCapturesMermaid: { emoji: '🧜', label: 'Pirate capture des sirènes' },
};

/** Ce que compte un compteur de bonus, la valeur venant du barème. */
export const COUNTER_UNITS: Partial<Record<BonusType, string>> = {
  skullKingCapturesPirate: 'pirate',
  pirateCapturesMermaid: 'sirène',
};

/** Libellé d'un événement stocké, Butin compris. */
export function bonusLabel(type: string): { emoji: string; label: string } {
  if (type === 'loot') return { emoji: '💰', label: 'Butin' };
  return CAPTURE_LABELS[type as BonusType] ?? { emoji: '✨', label: type };
}
