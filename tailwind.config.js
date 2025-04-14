/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Add paths to your map components here
    "./app/scenes/Map/**/*.{js,ts,jsx,tsx}",
    "./app/components/MapOverlayPanel.tsx",
    "./app/components/EthyrialMapFull.tsx",
    // Add other component paths if needed
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 