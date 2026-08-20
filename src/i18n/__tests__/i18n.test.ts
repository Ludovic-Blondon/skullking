import { translator } from '../translate';
import { en, fr, type MessageKey } from '../messages';

describe('catalogue', () => {
  it('traduit chaque clé française en anglais', () => {
    const missing = (Object.keys(fr) as MessageKey[]).filter((key) => !en[key]?.trim());
    expect(missing).toEqual([]);
  });

  it('n’ajoute aucune clé anglaise inconnue du français', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  /** Une chaîne à trous doit garder ses trous dans les deux langues. */
  it('conserve les mêmes paramètres dans les deux langues', () => {
    const holes = (template: string) =>
      [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(fr) as MessageKey[]) {
      expect({ key, holes: holes(en[key]) }).toEqual({ key, holes: holes(fr[key]) });
    }
  });
});

describe('accord du pluriel', () => {
  const t = { fr: translator('fr'), en: translator('en') };

  /** Le français met zéro au singulier, l'anglais non. */
  it.each([
    [0, '0 joueur et 0 partie', '0 players and 0 games'],
    [1, '1 joueur et 1 partie', '1 player and 1 game'],
    [4, '4 joueurs et 4 parties', '4 players and 4 games'],
  ])('accorde %s des deux côtés', (count, french, english) => {
    const params = { count, players: count, games: count };
    expect(t.fr('summary.playersAndGames', params)).toBe(french);
    expect(t.en('summary.playersAndGames', params)).toBe(english);
  });
});

describe('interpolation', () => {
  it('remplace les paramètres nommés', () => {
    expect(translator('fr')('home.resume', { round: 4 })).toBe('Reprendre — manche 4');
    expect(translator('en')('home.resume', { round: 4 })).toBe('Resume — round 4');
  });

  it('laisse le trou en place quand le paramètre manque', () => {
    expect(translator('fr')('home.resume')).toBe('Reprendre — manche {round}');
  });

  /** Mieux vaut une phrase dans la mauvaise langue qu'un identifiant à l'écran. */
  it('retombe sur le français quand une traduction manque', () => {
    const t = translator('en');
    const patched = { ...en };
    // @ts-expect-error — on simule une clé anglaise absente.
    delete patched['home.pitch'];
    expect(t('home.pitch')).toBe(en['home.pitch']);
    expect(translator('fr')('home.pitch')).toBe(fr['home.pitch']);
  });
});
