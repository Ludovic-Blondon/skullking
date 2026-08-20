import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { Text } from './text';

/** Décélération : le compteur part vite et se pose, plutôt que d'arriver sec. */
function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

const DURATION = 400;

type AnimatedNumberProps = {
  value: number;
  className?: string;
  maxFontSizeMultiplier?: number;
  /** Rendu final, si le nombre s'accompagne d'un signe ou d'une unité. */
  format?: (value: number) => string;
};

/**
 * Un total qui se recompte au lieu de sauter (PLAN.md §7.2, micro-interactions).
 *
 * À la validation d'une manche, voir le score défiler de l'ancien total au
 * nouveau dit ce qui vient de se passer bien mieux qu'un chiffre qui change.
 *
 * Deux garde-fous : la première valeur s'affiche telle quelle — on n'anime pas
 * l'ouverture d'un écran — et le réglage « réduire les animations » du système
 * est respecté, auquel cas le nombre change sans transition.
 */
export function AnimatedNumber({
  value,
  className,
  maxFontSizeMultiplier,
  format = String,
}: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion || from.current === value) {
      from.current = value;
      setDisplayed(value);
      return;
    }

    const start = Date.now();
    const origin = from.current;
    const delta = value - origin;

    const step = () => {
      const progress = Math.min((Date.now() - start) / DURATION, 1);
      setDisplayed(Math.round(origin + delta * easeOut(progress)));
      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      from.current = value;
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, reducedMotion]);

  return (
    <Text className={className} maxFontSizeMultiplier={maxFontSizeMultiplier}>
      {format(displayed)}
    </Text>
  );
}
