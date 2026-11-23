const { palettes } = require("./src/theme/themes.json");

// Each token is a CSS variable set at runtime by ThemeRoot (`bg-paper`, `text-ink`),
// so all three themes share one class name. `cam-*` is Night, fixed: camera screens stay dark.
const kebab = (key) => key.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`);
const colors = {};
for (const [key, value] of Object.entries(palettes.night)) {
  colors[kebab(key)] = `rgb(var(--${kebab(key)}) / <alpha-value>)`;
  colors[`cam-${kebab(key)}`] = value;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};
