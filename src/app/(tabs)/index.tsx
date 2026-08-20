import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/text';

import { db } from '@/db/client';
import { games } from '@/db/schema';
import { useT } from '@/i18n';
import { Screen, Watermark } from '@/ui/screen';

/** Raccourcis de l'accueil (PLAN.md §7.1) — la barre d'onglets reste la voie longue. */
const MENU: {
  emoji: string;
  key: 'tabs.history' | 'tabs.players' | 'tabs.stats' | 'route.settings';
  href: Href;
}[] = [
  { emoji: '📜', key: 'tabs.history', href: '/history' },
  { emoji: '👥', key: 'tabs.players', href: '/players' },
  { emoji: '📊', key: 'tabs.stats', href: '/stats' },
  { emoji: '⚙️', key: 'route.settings', href: '/settings' },
];

export default function HomeScreen() {
  const t = useT();
  // Reprise automatique d'une partie interrompue (PLAN.md §1 et §7.1).
  const { data: ongoing } = useLiveQuery(
    db
      .select()
      .from(games)
      .where(eq(games.status, 'in_progress'))
      .orderBy(desc(games.createdAt))
      .limit(1),
  );
  const current = ongoing[0];
  // La phase fait partie de ce que la carte annonce : sans elle, VoiceOver dit
  // « Reprendre — manche 2 » sans dire si la manche attend des annonces ou des
  // résultats.
  const phase = current
    ? t(current.currentPhase === 'bidding' ? 'home.phaseBidding' : 'home.phaseResults')
    : '';

  return (
    <View className="flex-1 bg-surface">
      <Watermark emoji="🏴‍☠️" size={220} />
      <Screen transparent>
        {current ? (
          <Link href={{ pathname: '/game/[id]', params: { id: String(current.id) } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('home.resume', { round: current.currentRound })} · ${phase}`}
              testID="resume-game"
              className="gap-1 rounded-card bg-primary p-4 active:opacity-80">
              <Text className="font-semi text-micro uppercase tracking-widest text-primary-fg opacity-70">
                {t('home.ongoing')}
              </Text>
              <Text className="font-title text-h2 text-primary-fg">
                {t('home.resume', { round: current.currentRound })}
              </Text>
              <Text className="font-body text-caption text-primary-fg opacity-70">{phase}</Text>
            </Pressable>
          </Link>
        ) : (
          <View className="gap-1 rounded-card bg-surface-raised p-4">
            <Text className="font-title text-h1 text-content">{t('home.title')}</Text>
            <Text className="font-body text-body text-content-muted">{t('home.pitch')}</Text>
          </View>
        )}

        <Link href="/game/new" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('route.newGame')}
            testID="new-game"
            className={`min-h-touch items-center justify-center rounded-card p-4 active:opacity-80 ${
              current ? 'bg-surface-raised' : 'bg-primary'
            }`}>
            <Text className={`font-title text-h2 ${current ? 'text-content' : 'text-primary-fg'}`}>
              {t('home.newGame')}
            </Text>
          </Pressable>
        </Link>

        <View className="flex-row flex-wrap gap-2.5">
          {MENU.map((item) => (
            <Link key={item.key} href={item.href} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(item.key)}
                className="min-h-touch flex-1 basis-[45%] items-center justify-center gap-1 rounded-field bg-surface-raised p-3.5 active:opacity-70">
                <Text className="text-lg">{item.emoji}</Text>
                <Text className="font-semi text-caption text-content-muted">{t(item.key)}</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <Link href="/rules" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.rules')}
            className="min-h-touch items-center justify-center active:opacity-70">
            <Text className="font-body text-caption text-content-muted">{t('home.rules')}</Text>
          </Pressable>
        </Link>
      </Screen>
    </View>
  );
}
