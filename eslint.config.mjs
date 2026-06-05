import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".wrangler/**",
      ".cloudflare-pages-build/**",
      ".cloudflare-pages-worker/**",
      "out/**"
    ]
  },
  ...nextVitals,
  ...nextTypescript
];

export default eslintConfig;
