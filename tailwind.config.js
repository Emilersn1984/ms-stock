/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern: /^(bg|text|border|ring|accent)-(primary|danger|warning|success|alert|accent)-(50|100|200|300|400|500|600|700|800|900)$/,
      variants: ['hover', 'focus', 'active', 'disabled'],
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* ── Charte Morphéa ── Turquoise #20808E / Tempête #074750 / Écume #E5F6F8 / Néon #5FF180 */
        primary: {
          50:  '#E5F6F8',  /* Écume — fonds très clairs */
          100: '#C0E9EE',
          200: '#8DD5DE',
          300: '#5ABDCA',
          400: '#38A5B4',
          500: '#20808E',  /* Turquoise — couleur brand principale */
          600: '#1A6B77',
          700: '#145560',
          800: '#0E3F4A',
          900: '#074750',  /* Tempête — titres, éléments sombres */
        },
        danger: {
          50:  '#FFF1F0',
          100: '#FFD9D6',
          200: '#FFB4AE',
          300: '#FF7A73',
          400: '#F75252',
          500: '#E53535',
          600: '#C42626',
          700: '#9E1B1B',
          800: '#781414',
        },
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C0',
          200: '#FDE47A',
          300: '#FBD140',
          400: '#F9BC1A',
          500: '#E9A20A',
          600: '#CC8D04',
          700: '#A67003',
        },
        success: {
          50:  '#EDFFF4',
          100: '#CAFEE2',
          200: '#96F9BC',
          300: '#5FF180',  /* Néon — succès, stock OK */
          400: '#35D964',
          500: '#22B84F',
          600: '#189140',
          700: '#12682F',
          800: '#0D4820',
        },
        alert: {
          50:  '#FFF6EB',
          100: '#FFE8C5',
          200: '#FFD197',
          300: '#FFB360',
          400: '#FF9232',
          500: '#F97316',
          600: '#E06010',
          700: '#BE4E0C',
        },
        accent: {
          100: '#C0E9EE',
          700: '#145560',
        },
      },
    },
  },
  plugins: [],
}
