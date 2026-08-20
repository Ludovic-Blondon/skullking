import { useEffect, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Une brève respiration quand quelque chose vient de changer (PLAN.md §7.2).
 *
 * Sert à désigner la ligne concernée au moment où son score bouge : l'œil suit
 * le mouvement avant même d'avoir lu le chiffre. L'effet reste discret — 2 % —
 * parce qu'il accompagne une information, il ne la remplace pas.
 *
 * Rien ne bouge si le système demande de réduire les animations.
 */
export function Pulse({
  trigger,
  children,
  className,
}: {
  /** Change de valeur pour déclencher la respiration. */
  trigger: string | number;
  children: ReactNode;
  className?: string;
}) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    scale.value = withSequence(
      withTiming(1.02, { duration: 120 }),
      withTiming(1, { duration: 220 }),
    );
  }, [trigger, reducedMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View className={className} style={style}>
      {children}
    </Animated.View>
  );
}
