(function () {
  "use strict";

  const safeText = (value, fallback = "") => {
    if (typeof value !== "string") return fallback;
    const text = value.trim();
    return text || fallback;
  };

  const universalBonuses = [
    {
      id: "life-long-health-calculators",
      baseTitle: "Life-Long Health Calculators",
      baseType: "Health Calculators",
      baseDescription:
        "Access useful health calculators and progress tools to better understand wellness indicators and track your journey over time.",
      valueLabel: "Worth Rs 3,200",
      actualValue: 3200,
      actualAvailability: true,
      assetType: "calculator_suite",
      actualAssetUrl: "",
      imageUrl: "/assets/bonus-life-long-health-calculators.png",
      imageAlt: "Health calculator and progress tool bonus visual",
      fallbackIcon: "calculator",
      editable: false,
    },
    {
      id: "lifetime-support-sessions",
      baseTitle: "Lifetime Support Sessions",
      baseType: "Support Sessions",
      baseDescription:
        "Join guided support sessions to stay consistent, informed, motivated, and supported throughout your wellness journey.",
      valueLabel: "Worth Rs 3,200",
      actualValue: 3200,
      actualAvailability: true,
      assetType: "support_session",
      actualAssetUrl: "",
      imageUrl: "/assets/bonus-lifetime-support-sessions.png",
      imageAlt: "Guided support session bonus visual",
      fallbackIcon: "chat",
      editable: false,
    },
    {
      id: "lifestyle-success-toolkit",
      baseTitle: "Lifestyle Success Toolkit",
      baseType: "Digital Toolkit",
      baseDescription:
        "Access practical lifestyle checklists, habit-building tools, implementation guides, and daily consistency resources.",
      valueLabel: "Worth Rs 3,599",
      actualValue: 3599,
      actualAvailability: true,
      assetType: "toolkit",
      actualAssetUrl: "",
      imageUrl: "/assets/bonus-lifestyle-success-toolkit.png",
      imageAlt: "Lifestyle success toolkit bonus visual",
      fallbackIcon: "checklist",
      editable: false,
    },
  ];

  const nicheAdaptiveBonusSection = {
    ruleKey: "nicheAdaptiveBonusSection",
    templateId: "canonical-coach-site-template",
    enabled: true,
    source: "universalBonusRegistry",
    cardCount: 3,
    aiAdaptive: true,
    editableSlots: [
      "bonus.eyebrow",
      "bonus.heading",
      "bonus.subheading",
      "bonus.items[].description",
      "bonus.ctaHelperText",
    ],
    lockedFields: [
      "bonus.id",
      "bonus.lockedAssetId",
      "bonus.items[].displayTitle",
      "bonus.items[].title",
      "bonus.visualType",
      "bonus.assetType",
      "bonus.actualAssetUrl",
      "bonus.actualValue",
      "bonus.actualAvailability",
      "legal.disclaimer",
      "cta.destination",
      "analytics.tracking",
    ],
    smartVisuals: true,
    regenerationRules: {
      wholeSection: true,
      oneBonusCard: true,
      ctaCopy: true,
      nicheFraming: true,
      assetIdentityLocked: true,
    },
    valueDisplayRules: {
      showConfiguredValue: true,
      showTotalValue: true,
      missingValueFallback: "Included Free",
      neverInventValue: true,
    },
    animationRules: {
      staggerReveal: true,
      hoverLift: true,
      softGlow: true,
      visualShine: true,
      reducedMotion: "disable-fancy-motion",
    },
    legalSafetyRules: {
      noFakeScarcity: true,
      noFakeUrgency: true,
      noMedicalCureClaims: true,
      noInventedAssets: true,
      noWrongNicheLeakage: true,
      preserveDisclaimers: true,
    },
    fallback: {
      eyebrow: "Included Free",
      heading: "Your Registration Includes Free Wellness Support Tools",
      subheading: "Practical tools to support your lifestyle journey.",
      ctaHeading: "Total bonus value: Rs 9,999",
      ctaHelperText:
        "Register to unlock these support tools with your coach registration. Takes less than 1 minute.",
      ctaText: "Register Now",
    },
  };

  const nicheProfiles = [
    {
      key: "pcos",
      keys: ["pcos", "pcod", "pmos", "hormone", "hormonal", "cycle", "women wellness", "women's wellness"],
      label: "Hormone Wellness",
      themes: "food rhythm, stress awareness, recovery, mindset, and everyday lifestyle habits",
      descriptions: [
        "Access wellness and progress tools to understand lifestyle markers, cycle patterns, habits, and body-awareness trends.",
        "Join support sessions to stay consistent with food rhythm, stress awareness, sleep, movement, and everyday hormone-supportive habits.",
        "Access hormone-friendly lifestyle checklists, habit trackers, food-rhythm tools, and daily consistency resources.",
      ],
    },
    {
      key: "metabolic",
      keys: ["diabet", "metabolic", "blood sugar", "insulin", "glucose"],
      label: "Metabolic Wellness",
      themes: "food choices, routine consistency, energy, movement, and everyday metabolic awareness",
      descriptions: [
        "Access calculators such as HbA1c, Insulin Resistance, eGFR, BMI, and BMR where relevant, helping you understand key wellness markers and track your progress.",
        "Join support sessions to stay consistent with food rhythm, activity, energy, and lifestyle habits while staying guided and motivated.",
        "Access sugar-aware lifestyle checklists, meal-rhythm tools, habit guides, and consistency resources for day-to-day implementation.",
      ],
    },
    {
      key: "gut",
      keys: ["gut", "digestion", "digestive", "bloating", "acidity", "constipation"],
      label: "Gut Wellness",
      themes: "food rhythm, digestion awareness, routine tracking, and calmer daily habits",
      descriptions: [
        "Access habit and symptom-awareness tools to notice food rhythm, digestion patterns, and daily wellness trends.",
        "Join support sessions to stay consistent with digestion-friendly routines, meal rhythm, stress awareness, and practical lifestyle habits.",
        "Access gut-friendly checklists, food-rhythm tools, daily tracking resources, and practical habit guides.",
      ],
    },
    {
      key: "sleep",
      keys: ["sleep", "recovery", "rest", "insomnia", "evening routine"],
      label: "Sleep Recovery",
      themes: "evening routine, stress regulation, recovery habits, and better daily rhythm",
      descriptions: [
        "Access sleep routine trackers, recovery reflection tools, and daily habit resources to understand patterns over time.",
        "Join support sessions to stay consistent with evening routines, stress awareness, recovery habits, and lifestyle rhythm.",
        "Access sleep-friendly checklists, routine builders, relaxation planning tools, and daily consistency guides.",
      ],
    },
    {
      key: "fatLoss",
      keys: ["fat loss", "weight loss", "weight management", "slim", "body composition"],
      label: "Fat-Loss Habit",
      themes: "meal rhythm, activity consistency, mindset, and sustainable habit-building",
      descriptions: [
        "Access BMI, BMR, habit tracking, progress checklists, and lifestyle tools to understand your wellness journey clearly.",
        "Join support sessions to stay consistent with meal rhythm, movement, planning, motivation, and sustainable habits.",
        "Access meal-planning checklists, activity habit tools, progress reflection guides, and daily consistency resources.",
      ],
    },
    {
      key: "fitness",
      keys: ["fitness", "strength", "workout", "exercise", "movement", "training"],
      label: "Strength & Consistency",
      themes: "training rhythm, movement consistency, recovery, and long-term motivation",
      descriptions: [
        "Access BMI/BMR, performance habit trackers, routine checklists, and progress tools to support your consistency.",
        "Join support sessions to stay consistent with movement, recovery, routine-building, motivation, and lifestyle rhythm.",
        "Access workout habit checklists, recovery planning tools, routine trackers, and daily consistency guides.",
      ],
    },
    {
      key: "general",
      keys: ["general wellness", "lifestyle wellness", "wellness"],
      label: "Wellness",
      themes: "daily habits, mindset, food rhythm, movement, and simple lifestyle consistency",
      descriptions: [
        "Access useful health calculators and progress tools to better understand wellness indicators and track your journey over time.",
        "Join guided support sessions to stay consistent, informed, motivated, and supported throughout your wellness journey.",
        "Access practical lifestyle checklists, habit-building tools, implementation guides, and daily consistency resources.",
      ],
    },
  ];

  function getReadableLabel(niche) {
    const normalized = safeText(niche, "wellness")
      .replace(/\b(coaching|coach|support|guidance|program|masterclass)\b/gi, "")
      .replace(/\b(reverse|reversal|cure|treatment|medicine|medicines|medication|medications)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return "Wellness";
    if (/\b(diabet|sugar|insulin|glucose)\b/i.test(normalized)) return "Metabolic Wellness";

    return normalized
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  function getProfile(options) {
    const explicitNiche = safeText(options.niche).toLowerCase();
    const explicitMatch = nicheProfiles.find((profile) => profile.keys.some((key) => explicitNiche.includes(key)));
    const haystack = [
      options.niche,
      options.bio,
      options.targetAudience,
      options.positioning,
      options.tone,
      options.pageCopy,
    ]
      .map((value) => safeText(value).toLowerCase())
      .join(" ");
    const allowsWomenOnlyCopy = /\b(women|woman|female|pcos|pcod|pmos|hormone|hormonal)\b/.test(haystack);
    const matched = explicitMatch || (!explicitNiche
      ? nicheProfiles.find((profile) => profile.keys.some((key) => haystack.includes(key)))
      : undefined);
    const label = matched ? matched.label : getReadableLabel(options.niche);
    const themes = matched
      ? matched.themes
      : `${label.toLowerCase()} clarity, habit consistency, personal reflection, and everyday wellness direction`;
    const fallbackProfile = nicheProfiles[nicheProfiles.length - 1];
    const descriptions = matched ? matched.descriptions : fallbackProfile.descriptions;

    return {
      allowsWomenOnlyCopy,
      key: matched ? matched.key : "general",
      label,
      themes,
      descriptions,
      heading: nicheAdaptiveBonusSection.fallback.heading,
      subheading: `Practical tools to support ${themes}. Built to feel useful from the moment you register.`,
    };
  }

  function getSmartBonusVisualType(assetType) {
    if (assetType === "digital_book") return "smart_book_cover";
    if (assetType === "video_training") return "smart_video_tile";
    if (assetType === "toolkit") return "smart_toolkit_tile";
    if (assetType === "support_session") return "smart_support_tile";
    return "smart_product_tile";
  }

  function getSmartBonusVisualCssType(visualType) {
    if (visualType === "smart_video_tile") return "video";
    if (visualType === "smart_toolkit_tile") return "toolkit";
    if (visualType === "smart_support_tile") return "support";
    if (visualType === "smart_product_tile") return "product";
    return "ebook";
  }

  function getSmartBonusVisualMark(item) {
    if (item.assetType === "calculator_suite" || item.fallbackIcon === "calculator") {
      return "Calc";
    }
    if (item.visualType === "smart_video_tile" || item.assetType === "video_training" || item.fallbackIcon === "play") {
      return "Play";
    }
    if (item.visualType === "smart_toolkit_tile" || item.assetType === "toolkit" || item.fallbackIcon === "checklist") {
      return "Use";
    }
    if (item.visualType === "smart_support_tile" || item.assetType === "support_session" || item.fallbackIcon === "chat") {
      return "Meet";
    }
    return "Read";
  }

  function adaptBonusSectionCopy(options = {}) {
    const profile = getProfile(options);
    const items = universalBonuses.map((bonus, index) => {
      const visualType = getSmartBonusVisualType(bonus.assetType);

      return {
        id: bonus.id,
        baseTitle: bonus.baseTitle,
        badge: `Bonus ${index + 1}`,
        displayTitle: bonus.baseTitle,
        title: bonus.baseTitle,
        typeLabel: bonus.baseType,
        subtitle: bonus.baseType,
        description: safeText(profile.descriptions[index], bonus.baseDescription),
        valueLine: bonus.valueLabel ? `${bonus.valueLabel} - Included Free` : nicheAdaptiveBonusSection.valueDisplayRules.missingValueFallback,
        valueDisplay: bonus.valueLabel ? `${bonus.valueLabel} - Included Free` : nicheAdaptiveBonusSection.valueDisplayRules.missingValueFallback,
        actualValue: bonus.actualValue,
        actualAvailability: bonus.actualAvailability,
        actualAssetUrl: bonus.actualAssetUrl,
        lockedAssetId: bonus.id,
        assetType: bonus.assetType,
        visualType,
        imageUrl: bonus.imageUrl,
        imageAlt: bonus.imageAlt,
        fallbackIcon: bonus.fallbackIcon,
        editable: bonus.editable,
      };
    });
    const totalValue = items.reduce((sum, item) => sum + (Number(item.actualValue) || 0), 0);
    const ctaHeading = totalValue > 0
      ? `Total bonus value: Rs ${totalValue.toLocaleString("en-IN")}`
      : "";

    return {
      ruleKey: nicheAdaptiveBonusSection.ruleKey,
      coachName: safeText(options.coachName, "Coach"),
      eyebrow: nicheAdaptiveBonusSection.fallback.eyebrow,
      heading: profile.heading,
      subheading: profile.subheading,
      ctaHeading,
      ctaSupportCopy: nicheAdaptiveBonusSection.fallback.ctaHelperText,
      ctaHelperText: nicheAdaptiveBonusSection.fallback.ctaHelperText,
      ctaText: nicheAdaptiveBonusSection.fallback.ctaText,
      ctaButtonText: nicheAdaptiveBonusSection.fallback.ctaText,
      totalValueLabel: ctaHeading,
      totalValueText: ctaHeading,
      items,
    };
  }

  function buildSmartBonusVisual(item, options = {}) {
    const visualCssType = getSmartBonusVisualCssType(item.visualType);
    const wrapper = document.createElement("div");
    wrapper.className = `yw-bonus-visual yw-smart-bonus-visual yw-bonus-visual--${visualCssType}`;
    wrapper.dataset.ywAssetType = item.assetType;
    wrapper.dataset.ywBonusId = item.id;
    wrapper.dataset.ywNiche = safeText(options.niche, "wellness");
    wrapper.dataset.ywSmartBonus = "true";
    wrapper.dataset.ywSmartVisual = item.imageUrl ? "configured-image" : "generated";
    wrapper.dataset.ywTemplateTheme = safeText(options.theme, "canonical-coach-site-template");
    wrapper.dataset.ywVisualType = item.visualType;

    if (item.imageUrl) {
      wrapper.setAttribute("role", "img");
      wrapper.setAttribute("aria-label", safeText(item.imageAlt, `${item.typeLabel} bonus visual`));
      wrapper.classList.add("yw-bonus-visual--image");
      wrapper.style.backgroundImage = `linear-gradient(135deg, rgba(4, 31, 39, 0.16), rgba(33, 230, 193, 0.18)), url("${item.imageUrl}")`;

      const orb = document.createElement("span");
      orb.className = "yw-bonus-visual__orb yw-bonus-visual__orb--image";
      orb.setAttribute("aria-hidden", "true");
      const microLines = document.createElement("span");
      microLines.className = "yw-bonus-visual__micro-lines";
      microLines.setAttribute("aria-hidden", "true");
      const shine = document.createElement("span");
      shine.className = "yw-bonus-visual__shine";
      shine.setAttribute("aria-hidden", "true");
      wrapper.append(orb, microLines, shine);
      return wrapper;
    }

    wrapper.dataset.ywFallbackIcon = item.fallbackIcon;
    wrapper.setAttribute("aria-hidden", "true");

    const orb = document.createElement("span");
    orb.className = "yw-bonus-visual__orb";
    const product = document.createElement("span");
    product.className = "yw-bonus-visual__product";
    const mark = document.createElement("span");
    mark.className = "yw-bonus-visual__mark";
    mark.textContent = getSmartBonusVisualMark(item);
    const microLines = document.createElement("span");
    microLines.className = "yw-bonus-visual__micro-lines";
    const shine = document.createElement("span");
    shine.className = "yw-bonus-visual__shine";

    product.append(mark);
    wrapper.append(orb, product, microLines, shine);
    return wrapper;
  }

  function setEditableMetadata(element, slot) {
    element.setAttribute("data-yw-inspect", "editable");
    element.setAttribute("data-yw-edit-slot", slot);
    element.setAttribute("data-yw-ai-regeneratable", "true");
  }

  function shouldPreserveCopy(value) {
    const text = safeText(value);
    return Boolean(text) && !/niche[-\s]?adaptive|internal|template|registry|placeholder/i.test(text);
  }

  function isUnsafeHealthCopy(value) {
    return /\b(cure|guarantee(?:d)?|reverse(?:d|s)?|reversal|without medicines?|stop(?:ping)? medicines?|diagnos(?:e|is)|treat(?:ment|s|ed)?|heal(?:s|ed|ing)? disease)\b/i.test(value);
  }

  function hasWrongServiceTitleLeakage(value, itemIndex) {
    const normalized = safeText(value).toLowerCase();
    const fixedTitle = universalBonuses[itemIndex] && universalBonuses[itemIndex].baseTitle.toLowerCase();
    const otherFixedTitles = universalBonuses
      .filter((_, index) => index !== itemIndex)
      .map((bonus) => bonus.baseTitle.toLowerCase());
    const referencesOtherService =
      otherFixedTitles.some((title) => normalized.includes(title)) || /\b(golden cage|vision board video)\b/i.test(value);

    return referencesOtherService ? !fixedTitle || !normalized.includes(fixedTitle) : false;
  }

  function hasWrongNicheBonusLeakage(value, profile) {
    const text = safeText(value);
    const normalized = text.toLowerCase();
    const specificNicheGroups = [
      {
        allowedKeys: ["metabolic"],
        pattern:
          /\b(hba1c|a1c|insulin(?:\s+resistance)?|egfr|blood\s+sugar|glucose|diabet(?:es|ic)?|sugar[-\s]?(?:aware|level|levels|spike|spikes)|metabolic)\b/i,
      },
      {
        allowedKeys: ["pcos"],
        pattern:
          /\b(pcos|pcod|pmos|hormonal?|hormone[-\s]?(?:aware|friendly|supportive)|cycle patterns?|periods?|menstrual|ovulation|women'?s?\s+hormone)\b/i,
      },
      {
        allowedKeys: ["gut"],
        pattern: /\b(gut|digestion|digestive|bloating|acidity|constipation|ibs)\b/i,
      },
      {
        allowedKeys: ["sleep"],
        pattern: /\b(sleep|insomnia|bedtime|circadian|evening routines?|sleep routine|recovery rhythm)\b/i,
      },
      {
        allowedKeys: ["fatLoss"],
        pattern: /\b(fat[-\s]?loss|weight[-\s]?loss|weight management|body composition|slimming)\b/i,
      },
      {
        allowedKeys: ["fitness"],
        pattern: /\b(fitness|strength|strength training|workouts?|exercise training|performance habit|training rhythm)\b/i,
      },
    ];

    if (/\b(only for women|women only|exclusively for women)\b/i.test(normalized) && !profile.allowsWomenOnlyCopy) {
      return true;
    }

    return specificNicheGroups.some(
      (group) => group.pattern.test(normalized) && !group.allowedKeys.includes(profile.key)
    );
  }

  function sanitizeBonusCopy(value, fallback, profile, itemIndex) {
    const text = safeText(value);
    if (!shouldPreserveCopy(text)) return fallback;
    if (isUnsafeHealthCopy(text) || hasWrongNicheBonusLeakage(text, profile)) return fallback;
    if (typeof itemIndex === "number" && hasWrongServiceTitleLeakage(text, itemIndex)) return fallback;
    return text;
  }

  function ensureCtaPanel(section, shell) {
    let panel = section.querySelector(".yw-bonus-cta-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.className = "yw-bonus-cta-panel";
    const total = document.createElement("p");
    total.className = "yw-bonus-total";
    total.setAttribute("data-yw-bonus-total", "");
    const helper = document.createElement("p");
    helper.className = "yw-bonus-cta-copy";
    const cta = section.querySelector(".yw-bonus-cta");
    panel.append(total, helper);
    if (cta) panel.append(cta);
    shell.append(panel);
    return panel;
  }

  function renderBonusSection(section, options = {}) {
    const model = adaptBonusSectionCopy(options);
    const shell = section.querySelector(".yw-bonus-shell");
    const kicker = section.querySelector(".yw-bonus-kicker");
    const heading = section.querySelector("#yw-bonus-title");
    const subheading = section.querySelector(".yw-section-subcopy");
    const grid = section.querySelector("[data-yw-bonus-grid]");

    if (!shell || !heading || !subheading || !grid) return model;
    const existingCards = Array.from(grid.querySelectorAll("article")).map((card) => ({
      title: safeText(card.querySelector("h3")?.textContent || ""),
      description: safeText(card.querySelector("p:not(.yw-bonus-type)")?.textContent || ""),
    }));
    const existingKicker = safeText(kicker?.textContent || "");
    const existingHeading = safeText(heading.textContent || "");
    const existingSubheading = safeText(subheading.textContent || "");
    const existingPanel = section.querySelector(".yw-bonus-cta-panel");
    const existingHelper = safeText(existingPanel?.querySelector(".yw-bonus-cta-copy")?.textContent || "");

    const profile = getProfile(getSectionOptions(section));

    model.eyebrow = sanitizeBonusCopy(existingKicker, model.eyebrow, profile);
    model.heading = sanitizeBonusCopy(existingHeading, model.heading, profile);
    model.subheading = sanitizeBonusCopy(existingSubheading, model.subheading, profile);
    model.ctaHelperText = sanitizeBonusCopy(existingHelper, model.ctaHelperText, profile);
    model.ctaSupportCopy = model.ctaHelperText;
    model.ctaText = nicheAdaptiveBonusSection.fallback.ctaText;
    model.ctaButtonText = nicheAdaptiveBonusSection.fallback.ctaText;
    model.items = model.items.map((item, index) => ({
      ...item,
      displayTitle: universalBonuses[index]?.baseTitle || item.displayTitle,
      title: universalBonuses[index]?.baseTitle || item.title,
      description: sanitizeBonusCopy(existingCards[index]?.description, item.description, profile, index),
    }));

    if (kicker) {
      kicker.textContent = model.eyebrow;
      setEditableMetadata(kicker, "bonus.eyebrow");
    }

    heading.textContent = model.heading;
    setEditableMetadata(heading, "bonus.heading");
    subheading.textContent = model.subheading;
    setEditableMetadata(subheading, "bonus.subheading");

    grid.replaceChildren();
    section.dataset.ywBonusCount = String(model.items.length);
    section.dataset.ywDetectedNiche = model.heading;

    model.items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "yw-niche-bonus__card";
      card.dataset.bonusId = item.id;
      card.dataset.bonusAssetType = item.assetType;
      card.dataset.bonusLockedAsset = "true";
      card.dataset.bonusVisualType = item.visualType;
      card.dataset.bonusActualAssetUrl = item.actualAssetUrl || "";
      card.dataset.bonusActualAvailability = item.actualAvailability ? "true" : "false";
      card.dataset.ywRegistrySource = nicheAdaptiveBonusSection.source;
      card.style.setProperty("--bonus-index", String(index));

      const top = document.createElement("div");
      top.className = "yw-bonus-card-top";
      const badge = document.createElement("div");
      badge.className = "yw-bonus-badge";
      badge.textContent = item.badge;
      const type = document.createElement("p");
      type.className = "yw-bonus-type";
      type.textContent = item.typeLabel;
      top.append(badge, type);

      const title = document.createElement("h3");
      title.textContent = item.displayTitle;

      const description = document.createElement("p");
      description.textContent = item.description;
      setEditableMetadata(description, `bonus.items.${index}.description`);

      const value = document.createElement("strong");
      value.textContent = item.valueDisplay;
      value.setAttribute("data-yw-locked", "actualValue");

      card.append(top, buildSmartBonusVisual(item, getSectionOptions(section)), title, description, value);
      grid.append(card);
    });

    const panel = ensureCtaPanel(section, shell);
    const total = panel.querySelector("[data-yw-bonus-total]");
    const helper = panel.querySelector(".yw-bonus-cta-copy");
    const cta = panel.querySelector(".yw-bonus-cta");

    if (total) {
      total.textContent = model.ctaHeading;
      total.hidden = !model.ctaHeading;
    }

    if (helper) {
      helper.textContent = model.ctaHelperText;
      setEditableMetadata(helper, "bonus.ctaHelperText");
    }

    if (cta) {
      cta.textContent = model.ctaButtonText;
      cta.setAttribute("data-yw-locked-destination", "true");
    }

    shell.dataset.ywNicheAdaptation = model.heading;
    return model;
  }

  function getSectionOptions(section) {
    return {
      coachName: section.dataset.ywCoachName,
      niche: section.dataset.ywCoachNiche,
      targetAudience: section.dataset.ywTargetAudience,
      positioning: section.dataset.ywCoachPositioning,
      tone: section.dataset.ywWebsiteTone,
      theme: section.dataset.ywTemplateTheme,
      pageCopy: document.body ? document.body.innerText.slice(0, 4000) : "",
    };
  }

  function initBonusSections() {
    document.querySelectorAll("[data-yw-template-rule='nicheAdaptiveBonusSection']").forEach((section) => {
      renderBonusSection(section, getSectionOptions(section));
    });
  }

  window.YWN_UNIVERSAL_BONUSES = universalBonuses;
  window.YWN_TEMPLATE_RULES = Object.assign({}, window.YWN_TEMPLATE_RULES, {
    nicheAdaptiveBonusSection,
  });
  window.ywAdaptBonusSectionCopy = adaptBonusSectionCopy;
  window.ywRenderNicheAdaptiveBonusSection = renderBonusSection;
  window.ywPreviewNicheAdaptiveBonus = function (
    niche,
    section = document.querySelector("[data-yw-template-rule='nicheAdaptiveBonusSection']")
  ) {
    if (!section) return null;
    section.dataset.ywCoachNiche = safeText(niche, "general wellness");
    return renderBonusSection(section, getSectionOptions(section));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBonusSections, { once: true });
  } else {
    initBonusSections();
  }
})();
