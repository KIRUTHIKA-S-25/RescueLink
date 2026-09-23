/** @type {import('tailwindcss').Config} */
export default {
  // Tell Tailwind which files to scan for class names.
  // It removes unused CSS classes from the production build — keeping it tiny.
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Custom brand colors for RescueLink
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',  // Main brand blue
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        rescue: {
          critical: '#dc2626', // Red
          high:     '#ea580c', // Orange
          medium:   '#ca8a04', // Yellow
          low:      '#16a34a', // Green
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
