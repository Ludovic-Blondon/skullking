/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          raised: 'rgb(var(--color-surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--color-surface-sunken) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          strong: 'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--color-content) / <alpha-value>)',
          muted: 'rgb(var(--color-content-muted) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          fg: 'rgb(var(--color-primary-fg) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          fg: 'rgb(var(--color-accent-fg) / <alpha-value>)',
        },
        positive: 'rgb(var(--color-positive) / <alpha-value>)',
        negative: 'rgb(var(--color-negative) / <alpha-value>)',
      },
      /**
       * Outfit en quatre graisses. Les polices Google statiques s'enregistrent
       * comme des familles distinctes : la graisse se choisit par la famille
       * (`font-title`), jamais par `font-bold`, qui ne ferait que demander à iOS
       * de grossir artificiellement la fonte.
       */
      fontFamily: {
        body: ['Outfit_500Medium'],
        semi: ['Outfit_600SemiBold'],
        title: ['Outfit_700Bold'],
        display: ['Outfit_800ExtraBold'],
      },
      /** Échelle typographique de la maquette (Display → Micro). */
      fontSize: {
        display: ['32px', { lineHeight: '38px' }],
        h1: ['22px', { lineHeight: '28px' }],
        h2: ['17px', { lineHeight: '22px' }],
        body: ['15px', { lineHeight: '20px' }],
        caption: ['13px', { lineHeight: '17px' }],
        micro: ['11px', { lineHeight: '14px' }],
      },
      borderRadius: {
        /** Carte joueur et boutons pleine largeur. */
        card: '18px',
        /** Lignes de réglage, champs, tuiles. */
        field: '14px',
        /** Cellule de feuille de score. */
        tile: '8px',
        /** Coiffe des bottom sheets. */
        sheet: '28px',
      },
      spacing: {
        // Cible tactile minimale (§12.10 du plan) : 44 pt.
        touch: '44px',
        // Pastille d'un stepper : plus petite à l'œil, élargie au `hitSlop`.
        step: '32px',
      },
    },
  },
  plugins: [],
};
