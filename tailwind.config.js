/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Add paths to your map components here
    "./app/scenes/Map/**/*.{js,ts,jsx,tsx}",
    "./app/components/MapOverlayPanel.tsx",
    "./app/components/EthyrialMapFull.tsx",
    "./app/components/**/*.{js,ts,jsx,tsx}",
    // Add other component paths if needed
  ],
  theme: {
    extend: {
      // Add a custom color for testing
      colors: {
        'debug-red': '#ff0000',
      },
      // Add Asul font family
      fontFamily: {
        asul: ['Asul', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
} 