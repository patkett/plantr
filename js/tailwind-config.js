// Tailwind CSS (Play CDN) theme configuration for the Verdant brand.
// "Ligne claire" palette: flat, saturated colours taken from the title
// illustration (sky, leaf greens, sand path, coral bromeliads, orchid blue).
// Must load after the cdn.tailwindcss.com <script> tag.
tailwind.config = {
  theme: {
    extend: {
      colors: {
        ink: '#1a1a1a',
        paper: '#f7f0dc',
        sky: { 50: '#eaf7fb', 100: '#d3eef6', 200: '#b3e2ef', 300: '#9fd8ea', 400: '#6fc3de', 500: '#3f9fc4', 600: '#2f7f9f', 700: '#256579' },
        // warm cream / sand neutrals instead of grey
        stone: {
          50: '#fbf7ec', 100: '#f7f0dc', 200: '#ecdcb6', 300: '#dcc48f', 400: '#b19c6a',
          500: '#7d6c4b', 600: '#54492f', 700: '#38311f', 800: '#262216', 900: '#1a1a1a'
        },
        // leaf greens
        brand: {
          50: '#eef6e4', 100: '#dbeec6', 200: '#bce09a', 300: '#9bce6c', 400: '#6fae4c', 500: '#52913a',
          600: '#3f7132', 700: '#33592b', 800: '#274523', 900: '#1c331a'
        },
        emerald: {
          50: '#eef6e4', 100: '#dbeec6', 200: '#bce09a', 300: '#9bce6c', 400: '#6fae4c', 500: '#52913a',
          600: '#3f7132', 700: '#33592b', 800: '#274523', 900: '#1c331a'
        },
        // sun yellow / orange (bed light levels)
        amber: { 100: '#fbeaa8', 200: '#f7dd7a', 300: '#f4d052', 400: '#f0c22e', 500: '#e5ad1c', 600: '#c98f12', 700: '#9e6f0e', 800: '#6f4e0a' },
        orange: { 100: '#fbe0bf', 200: '#f6c98e', 300: '#f0ac5c', 400: '#e9903a', 500: '#d8772a', 700: '#8f4a17' },
        // coral bromeliads
        red: { 100: '#fbd9d0', 200: '#f5b6a6', 300: '#ee8f79', 600: '#e2573c', 700: '#c4432c', 900: '#7a2a1c' },
        rose: { 100: '#fbd9d0', 200: '#f5b6a6', 500: '#e2573c', 700: '#c4432c' },
        terracotta: { 500: '#e2573c', 600: '#c4432c' },
        // orchid blue (wishlist / Patrick)
        purple: { 100: '#d6e4f8', 200: '#b1cbf1', 700: '#2f63b8' },
        blue: { 50: '#e3eefb', 100: '#d6e4f8', 200: '#b1cbf1', 700: '#2f63b8' },
        // cool shade grey-blue
        slate: { 200: '#c9d6df', 300: '#a9bcc9', 400: '#7f98a9', 800: '#2c3c48' }
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
        serif: ['Fredoka', 'sans-serif']
      }
    }
  }
}
