import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#76FB91',
          light: '#a3fcae',
          dark: '#45e566',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8f9fa',
        },
        border: {
          DEFAULT: '#EDEDED',
          strong: '#CCCCCC',
        },
        content: {
          DEFAULT: '#000000',
          muted: '#6b7280', // standard gray for subtext
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 20px rgba(118, 251, 145, 0.4)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      }
    },
  },
  plugins: [],
} satisfies Config;
