import { catalogs, fr, type Language, type MessageKey } from '../messages';
import { dateLocale, deviceLanguage, ordinalSuffix, translator } from '../translate';

const OTHERS: Language[] = ['en', 'es', 'de'];
const keys = Object.keys(fr) as MessageKey[];

describe('catalogue', () => {
  it.each(OTHERS)('traduit chaque clé française en %s', (language) => {
    const missing = keys.filter((key) => !catalogs[language][key]?.trim());
    expect(missing).toEqual([]);
  });

  it.each(OTHERS)('n’ajoute aucune clé %s inconnue du français', (language) => {
    expect(Object.keys(catalogs[language]).sort()).toEqual(keys.slice().sort());
  });

  /** Une chaîne à trous doit garder ses trous dans les quatre langues. */
  it.each(OTHERS)('conserve les mêmes paramètres en %s', (language) => {
    const holes = (template: string) =>
      [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of keys) {
      expect({ key, holes: holes(catalogs[language][key]) }).toEqual({
        key,
        holes: holes(fr[key]),
      });
    }
  });
});

describe('accord du pluriel', () => {
  /** Le français met zéro au singulier ; les trois autres langues, non. */
  it.each([
    [0, '0 partie', '0 games'],
    [1, '1 partie', '1 game'],
    [4, '4 parties', '4 games'],
  ])('accorde %s en français et en anglais', (count, french, english) => {
    expect(translator('fr')('summary.games', { count })).toBe(french);
    expect(translator('en')('summary.games', { count })).toBe(english);
  });

  it.each([
    [0, '0 partidas', '0 Partien'],
    [1, '1 partida', '1 Partie'],
    [4, '4 partidas', '4 Partien'],
  ])('accorde %s en espagnol et en allemand', (count, spanish, german) => {
    expect(translator('es')('summary.games', { count })).toBe(spanish);
    expect(translator('de')('summary.games', { count })).toBe(german);
  });
});

describe('interpolation', () => {
  it('remplace les paramètres nommés', () => {
    expect(translator('fr')('home.resume', { round: 4 })).toBe('Reprendre — manche 4');
    expect(translator('es')('home.resume', { round: 4 })).toBe('Reanudar — ronda 4');
    expect(translator('de')('home.resume', { round: 4 })).toBe('Fortsetzen — Runde 4');
  });

  it('laisse le trou en place quand le paramètre manque', () => {
    expect(translator('fr')('home.resume')).toBe('Reprendre — manche {round}');
  });

  /** Mieux vaut une phrase dans la mauvaise langue qu'un identifiant à l'écran. */
  it('retombe sur le français quand une traduction manque', () => {
    const german = catalogs.de['home.pitch'];
    // @ts-expect-error — on simule une traduction allemande absente.
    delete catalogs.de['home.pitch'];
    expect(translator('de')('home.pitch')).toBe(fr['home.pitch']);
    catalogs.de['home.pitch'] = german;
    expect(translator('de')('home.pitch')).toBe(german);
  });
});

describe('langue de l’appareil', () => {
  const withLocale = (locale: string) =>
    jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ locale } as Intl.ResolvedDateTimeFormatOptions);

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['fr-CA', 'fr'],
    ['en-US', 'en'],
    ['es-419', 'es'],
    ['de-AT', 'de'],
  ])('reconnaît %s', (locale, expected) => {
    withLocale(locale);
    expect(deviceLanguage()).toBe(expected);
  });

  /** Une langue qu'on ne parle pas retombe sur l'anglais, pas sur le français. */
  it('retombe sur l’anglais pour une locale inconnue', () => {
    withLocale('it-IT');
    expect(deviceLanguage()).toBe('en');
  });
});

describe('formats locaux', () => {
  it.each([
    ['fr' as const, 'fr-FR'],
    ['en' as const, 'en-GB'],
    ['es' as const, 'es-ES'],
    ['de' as const, 'de-DE'],
  ])('date le %s chez lui', (language, locale) => {
    expect(dateLocale(language)).toBe(locale);
  });

  /** Le suffixe ordinal était français quelle que soit la langue avant la P7. */
  it.each([
    ['fr' as const, 1, 'ʳᵉ'],
    ['fr' as const, 3, 'ᵉ'],
    ['es' as const, 1, '.ª'],
    ['de' as const, 3, '.'],
  ])('accorde l’ordinal en %s', (language, value, expected) => {
    expect(ordinalSuffix(language, value)).toBe(expected);
  });

  /** L'anglais choisit son suffixe sur le chiffre des unités, sauf 11 à 13. */
  it.each([
    [1, 'st'],
    [2, 'nd'],
    [3, 'rd'],
    [4, 'th'],
    [11, 'th'],
    [12, 'th'],
    [13, 'th'],
    [21, 'st'],
  ])('accorde l’ordinal anglais de %s', (value, expected) => {
    expect(ordinalSuffix('en', value)).toBe(expected);
  });
});
