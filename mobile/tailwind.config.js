const kami = require("./src/theme/kami.json");

// Every token becomes a pair: `paper` (light) and `paper-dark`, e.g. "bg-paper dark:bg-paper-dark".
const kebab = (key) => key.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`);
const colors = {};
for (const [key, value] of Object.entries(kami.light)) {
  colors[kebab(key)] = value;
  colors[`${kebab(key)}-dark`] = kami.dark[key];
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
