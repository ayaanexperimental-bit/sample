import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".wrangler/**",
      ".cloudflare-pages-build/**",
      ".cloudflare-pages-worker/**",
      "out/**",
      "public/coach-circle-lenis.min.js",
      "public/external/**",
      "public/ort/**",
      "public/uploads/**",
      "public/wp-content/**"
    ]
  },
  ...nextVitals,
  ...nextTypescript
];

export default eslintConfig;
