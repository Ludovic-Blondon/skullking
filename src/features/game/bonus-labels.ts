import type { BonusType } from '@/core';
import type { MessageKey } from '@/i18n';

/**
 * Libellés de bonus — sémantiques, jamais des points bruts (PLAN.md §7.3).
 * Les valeurs, elles, viennent toujours du barème du `Ruleset`.
 *
 * Ce module ne renvoie que des **clés** : la saisie et la lecture nomment ainsi
 * un bonus de la même façon, dans la langue de l'utilisateur.
 */
export const CAPTURE_LABELS: Record<BonusType, { emoji: string; key: MessageKey }> = {
  yellow14: { emoji: '🟡', key: 'bonus.yellow14' },
  green14: { emoji: '🟢', key: 'bonus.green14' },
  purple14: { emoji: '🟣', key: 'bonus.purple14' },
  black14: { emoji: '⚫', key: 'bonus.black14' },
  mermaidCapturesSkullKing: { emoji: '⚔️', key: 'bonus.mermaidCapturesSkullKing' },
  skullKingCapturesPirate: { emoji: '☠️', key: 'bonus.skullKingCapturesPirate' },
  pirateCapturesMermaid: { emoji: '🧜', key: 'bonus.pirateCapturesMermaid' },
};

/** Ce que compte un compteur de bonus, la valeur venant du barème. */
export const COUNTER_UNITS: Partial<Record<BonusType, MessageKey>> = {
  skullKingCapturesPirate: 'bonus.unit.pirate',
  pirateCapturesMermaid: 'bonus.unit.mermaid',
};

/** Libellé d'un événement stocké, Butin compris. */
export function bonusLabel(type: string): { emoji: string; key: MessageKey } {
  if (type === 'loot') return { emoji: '💰', key: 'bonus.loot' };
  return CAPTURE_LABELS[type as BonusType] ?? { emoji: '✨', key: 'bonus.loot' };
}
