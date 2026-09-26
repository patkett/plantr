// Tailwind CSS (Play CDN) theme configuration for the SaParadise brand.
// Must load after the cdn.tailwindcss.com <script> tag.
tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7f4',
          100: '#e1ede6',
          200: '#c5dcd0',
          300: '#9cc2b1',
          400: '#6ea38f',
          500: '#4c8772',
          600: '#396c5b',
          700: '#2f574a',
          800: '#28473e',
          900: '#233c35',
        },
        terracotta: {
          500: '#e06d53',
          600: '#c8563c'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif']
      }
    }
  }
}
