import { expect, test } from "@playwright/test";
import {
  CANONICAL_COACH_TEMPLATE_THEME_ID,
  COACH_TEMPLATE_THEME_IDS,
  coachTemplateThemes,
  normalizeCoachTemplateThemeId
} from "../../lib/coach-template-themes";
import {
  getCanonicalHeroPackage,
  getCanonicalRegisterLabel,
  getNicheAdaptiveBonusSection
} from "../../lib/coach-canonical-template";
import { buildCoachSiteFromShopState, normalizeShopBuilderState } from "../../lib/shop-builder";

const LEGACY_THEME_IDS = [
  "default",
  "premium-feminine-wellness",
  "apple-liquid-glass",
  "dark-luxury-wellness",
  "not-a-real-template"
];

const UNSAFE_HEALTH_COPY =
  /\b(cure|guarantee(?:d)?|reverse(?:d|s)?|reversal|without medicines?|stop(?:ping)? medicines?|diagnos(?:e|is)|treat(?:ment|s|ed)?|heal(?:s|ed|ing)? disease)\b/i;

test.describe("canonical coach template rules", () => {
  test("only the canonical template is active and all old IDs normalize to it", () => {
    expect(COACH_TEMPLATE_THEME_IDS).toEqual([CANONICAL_COACH_TEMPLATE_THEME_ID]);
    expect(coachTemplateThemes).toHaveLength(1);
    expect(coachTemplateThemes[0].id).toBe(CANONICAL_COACH_TEMPLATE_THEME_ID);

    for (const themeId of LEGACY_THEME_IDS) {
      expect(normalizeCoachTemplateThemeId(themeId)).toBe(CANONICAL_COACH_TEMPLATE_THEME_ID);
      expect(normalizeShopBuilderState({ selectedThemeId: themeId }).selectedThemeId).toBe(
        CANONICAL_COACH_TEMPLATE_THEME_ID
      );
    }
  });

  test("canonical hero and bonus copy stay niche-adaptive without unsafe health claims", () => {
    const niches = [
      "Diabetes reversal without medicines",
      "PMOS and hormone wellness",
      "Metabolic wellness",
      "Career confidence coaching",
      "Fitness and lifestyle habits"
    ];

    for (const niche of niches) {
      const site = buildCoachSiteFromShopState({
        published: true,
        state: {
          coachName: `Coach ${niche.split(" ")[0]}`,
          contactLink: "https://forms.gle/example",
          content: {
            heroHeadline:
              "Reverse Type 2 Diabetes Naturally Without Medicines, Strict Diet or Complex Workouts Using My Proven Magical Lifestyle Method",
            heroTrustLine: "Guaranteed cure blueprint",
            subheadline:
              "Learn how to reverse disease without medicines and guarantee results in a few days."
          },
          niche,
          selectedThemeId: "dark-luxury-wellness",
          shortBio: "Practical education-first coaching support."
        }
      });

      expect(site.selectedThemeId).toBe(CANONICAL_COACH_TEMPLATE_THEME_ID);

      const hero = getCanonicalHeroPackage(site);
      expect(hero.headline).not.toMatch(UNSAFE_HEALTH_COPY);
      expect(hero.highlight).not.toMatch(UNSAFE_HEALTH_COPY);
      expect(hero.subheadline).not.toMatch(UNSAFE_HEALTH_COPY);
      expect(hero.supportLine).not.toMatch(UNSAFE_HEALTH_COPY);

      const registerLabel = getCanonicalRegisterLabel(site);
      expect(registerLabel).not.toMatch(/^(register|register now|register for free)$/i);
      expect(registerLabel).not.toMatch(UNSAFE_HEALTH_COPY);

      const bonus = getNicheAdaptiveBonusSection(site);
      expect(bonus.items).toHaveLength(2);
      expect(bonus.totalValueLabel).toBe("Total bonus value: Rs 6,400");
      expect(bonus.ctaText).toBe(registerLabel);
      expect([bonus.heading, bonus.subheading, ...bonus.items.map((item) => `${item.title} ${item.description}`)]).not.toEqual(
        expect.arrayContaining([expect.stringMatching(UNSAFE_HEALTH_COPY)])
      );
    }
  });
});
