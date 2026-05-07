import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".next/**", ".open-next/**", ".wrangler/**", ".cloudflare-pages-build/**", "out/**"]
  },
  ...nextVitals,
  ...nextTypescript
];

export default eslintConfig;
