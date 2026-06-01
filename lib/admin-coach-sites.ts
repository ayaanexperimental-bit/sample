export type CoachSiteStatus = "archived" | "draft" | "paused" | "published" | "removed";

export type CoachSiteContent = {
  benefits: string[];
  coachIntro: string;
  ctaText: string;
  faq: Array<{
    answer: string;
    question: string;
  }>;
  heroHeadline: string;
  socialCopy: string;
  subheadline: string;
  trustText: string;
  visionText: string;
};

export type CoachSiteAnalyticsSummary = {
  averageVisits: number;
  conversionRate: string;
  dailyVisits: number;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  lastUpdated: string;
  monthlyVisits: number;
  region: string;
  source: string;
  totalRegisterClicks: number;
  totalVisits: number;
  totalWhatsappClicks: number;
  videoPlays: number;
  weeklyVisits: number;
};

export type CoachSiteRecord = {
  bio: string;
  coachEmail: string;
  coachId: string;
  coachName: string;
  coachPhone: string;
  content: CoachSiteContent;
  googleFormUrl: string;
  id: string;
  location: string;
  logoUrl: string;
  niche: string;
  photoUrl: string;
  publicUrl: string;
  registerButtonText: string;
  slug: string;
  status: CoachSiteStatus;
  supportText: string;
  videoUrl: string;
  vision: string;
  whatsappLink: string;
  analytics: CoachSiteAnalyticsSummary;
};

export type PublicCoachSiteRecord = Omit<CoachSiteRecord, "analytics" | "coachId" | "id">;

export type CoachSiteFormState = {
  benefitsText: string;
  bio: string;
  coachEmail: string;
  coachName: string;
  coachPhone: string;
  coachIntro: string;
  ctaText: string;
  faqText: string;
  googleFormUrl: string;
  heroHeadline: string;
  location: string;
  logoUrl: string;
  niche: string;
  photoUrl: string;
  registerButtonText: string;
  slug: string;
  socialCopy: string;
  subheadline: string;
  supportText: string;
  trustText: string;
  videoUrl: string;
  vision: string;
  visionText: string;
  whatsappLink: string;
};

export const EMPTY_COACH_SITE_FORM: CoachSiteFormState = {
  benefitsText: "",
  bio: "",
  coachEmail: "",
  coachName: "",
  coachPhone: "",
  coachIntro: "",
  ctaText: "Register Now",
  faqText: "",
  googleFormUrl: "",
  heroHeadline: "",
  location: "",
  logoUrl: "",
  niche: "",
  photoUrl: "",
  registerButtonText: "Register Now",
  slug: "",
  socialCopy: "",
  subheadline: "",
  supportText: "",
  trustText: "",
  videoUrl: "",
  vision: "",
  visionText: "",
  whatsappLink: ""
};

export const COACH_PUBLIC_ROUTE_PREFIX = "/coach";

export const demoCoachSites: CoachSiteRecord[] = [
  {
    id: "coach-site-gyana-ranjan",
    coachId: "coach-gyana",
    coachName: "Gyana Ranjan",
    niche: "PCOS / Women Wellness",
    location: "Odisha",
    bio: "Practical wellness coach helping women understand hormones and daily lifestyle routines.",
    vision:
      "Make hormone education calmer, practical, and easier to follow alongside medical guidance.",
    coachEmail: "",
    coachPhone: "",
    whatsappLink: "",
    photoUrl: "/images/coach-gyana-ranjan.png",
    logoUrl: "",
    videoUrl:
      "https://www.youtube.com/embed/gBQoms47fB8?playsinline=1&controls=1&rel=0&modestbranding=1",
    googleFormUrl: "",
    slug: "gyana-ranjan",
    publicUrl: "/coach/gyana-ranjan",
    status: "published",
    supportText: "",
    registerButtonText: "Register Now",
    content: {
      heroHeadline: "Meet Gyana Ranjan for practical PCOS lifestyle guidance.",
      subheadline:
        "A fixed-template coach referral page introducing the coach, niche, vision, and next registration step.",
      coachIntro:
        "Gyana helps women slow down confusing hormone advice and rebuild simple routines around food, movement, sleep, stress, and tracking.",
      visionText:
        "Support women with education-first guidance that fits real life and works alongside medical advice when needed.",
      benefits: [
        "Understand common lifestyle patterns connected to PCOS symptoms.",
        "Get a calmer view of food, movement, sleep, and routine consistency.",
        "Know the right next step before joining a deeper program."
      ],
      ctaText: "Register Now",
      faq: [
        {
          question: "Is this medical treatment?",
          answer: "No. This coach page is for education and lifestyle guidance only."
        },
        {
          question: "What happens after registration?",
          answer: "The register button opens the admin-provided Google Form when configured."
        }
      ],
      trustText:
        "Education-first, doctor-friendly coaching support. This does not replace diagnosis or treatment.",
      socialCopy:
        "Join Gyana Ranjan's PCOS lifestyle guidance page for a clear first step."
    },
    analytics: {
      averageVisits: 140,
      conversionRate: "17.5%",
      dailyVisits: 186,
      deviceBreakdown: {
        desktop: 14,
        mobile: 80,
        tablet: 6
      },
      lastUpdated: "Demo data",
      monthlyVisits: 4210,
      region: "Odisha",
      source: "Coach social sharing",
      totalRegisterClicks: 738,
      totalVisits: 4210,
      totalWhatsappClicks: 0,
      videoPlays: 392,
      weeklyVisits: 980
    }
  },
  {
    id: "coach-site-sample-a",
    coachId: "coach-sample-a",
    coachName: "Sample Coach A",
    niche: "Weight Loss",
    location: "Kolkata",
    bio: "Sample coach site record used for admin UI review only.",
    vision: "Help guests take a practical first step toward daily wellness habits.",
    coachEmail: "",
    coachPhone: "",
    whatsappLink: "",
    photoUrl: "",
    logoUrl: "",
    videoUrl: "",
    googleFormUrl: "",
    slug: "sample-coach-a",
    publicUrl: "/coach/sample-coach-a",
    status: "paused",
    supportText: "",
    registerButtonText: "Register Now",
    content: {
      heroHeadline: "A practical first step with Sample Coach A.",
      subheadline: "Demo coach referral site content for review.",
      coachIntro: "This is sample copy. Replace with real approved coach details before publishing.",
      visionText: "Guide guests through clear, sustainable habits.",
      benefits: ["Simple routine clarity", "Supportive coach introduction", "Clear registration step"],
      ctaText: "Register Now",
      faq: [
        {
          question: "Is this real data?",
          answer: "No. This is demo data for UI and workflow review."
        }
      ],
      trustText: "Demo trust text for the fixed coach template.",
      socialCopy: "Demo sharing copy for Sample Coach A."
    },
    analytics: {
      averageVisits: 99,
      conversionRate: "17.1%",
      dailyVisits: 74,
      deviceBreakdown: {
        desktop: 17,
        mobile: 77,
        tablet: 6
      },
      lastUpdated: "Demo data",
      monthlyVisits: 2980,
      region: "Kolkata",
      source: "Coach social sharing",
      totalRegisterClicks: 511,
      totalVisits: 2980,
      totalWhatsappClicks: 12,
      videoPlays: 0,
      weeklyVisits: 620
    }
  }
];

export function getCoachPublicUrl(slug: string) {
  return `${COACH_PUBLIC_ROUTE_PREFIX}/${normalizeCoachSlug(slug)}`;
}

export function getPublicCoachSiteBySlug(slug: string) {
  const normalizedSlug = normalizeCoachSlug(slug);
  const site =
    demoCoachSites.find(
      (record) =>
        record.slug === normalizedSlug &&
        (record.status === "published" || record.status === "paused")
    ) || null;

  return site ? toPublicCoachSiteRecord(site) : null;
}

export function toPublicCoachSiteRecord(site: CoachSiteRecord): PublicCoachSiteRecord {
  return {
    bio: site.bio,
    coachEmail: site.coachEmail,
    coachName: site.coachName,
    coachPhone: site.coachPhone,
    content: site.content,
    googleFormUrl: site.googleFormUrl,
    location: site.location,
    logoUrl: site.logoUrl,
    niche: site.niche,
    photoUrl: site.photoUrl,
    publicUrl: site.publicUrl,
    registerButtonText: site.registerButtonText,
    slug: site.slug,
    status: site.status,
    supportText: site.supportText,
    videoUrl: site.videoUrl,
    vision: site.vision,
    whatsappLink: site.whatsappLink
  };
}

export function normalizeCoachSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function createCoachContentFromForm(form: CoachSiteFormState): CoachSiteContent {
  const coachName = form.coachName.trim() || "Coach";
  const niche = form.niche.trim() || "wellness";
  const vision = form.vision.trim() || "support guests with practical wellness guidance";
  const bio = form.bio.trim() || "A Yours Wellness coach focused on simple, supportive guidance.";

  return {
    heroHeadline:
      form.heroHeadline.trim() || `Meet ${coachName} for practical ${niche} guidance.`,
    subheadline:
      form.subheadline.trim() ||
      `A fixed-template coach referral page introducing ${coachName}, their niche, vision, and registration step.`,
    coachIntro: form.coachIntro.trim() || bio,
    visionText: form.visionText.trim() || vision,
    benefits: parseLines(form.benefitsText, [
      `Understand the basics of ${niche} with a clear coach introduction.`,
      "See the coach vision before opening the registration form.",
      "Move to the admin-provided Google Form only after the register click is tracked."
    ]),
    ctaText: form.ctaText.trim() || form.registerButtonText.trim() || "Register Now",
    faq: parseFaq(form.faqText),
    trustText:
      form.trustText.trim() ||
      "This page is for coach introduction and education. It does not replace medical advice.",
    socialCopy:
      form.socialCopy.trim() ||
      `Join ${coachName}'s ${niche} referral page for a clear first step.`
  };
}

export function createCoachSiteFromForm(input: {
  form: CoachSiteFormState;
  id: string;
  status: CoachSiteStatus;
}): CoachSiteRecord {
  const slug = normalizeCoachSlug(input.form.slug || input.form.coachName);
  const content = createCoachContentFromForm(input.form);

  return {
    id: input.id,
    coachId: `coach-${slug}`,
    coachName: input.form.coachName.trim(),
    niche: input.form.niche.trim(),
    location: input.form.location.trim(),
    bio: input.form.bio.trim(),
    vision: input.form.vision.trim(),
    coachEmail: input.form.coachEmail.trim(),
    coachPhone: input.form.coachPhone.trim(),
    whatsappLink: input.form.whatsappLink.trim(),
    photoUrl: input.form.photoUrl.trim(),
    logoUrl: input.form.logoUrl.trim(),
    videoUrl: input.form.videoUrl.trim(),
    googleFormUrl: input.form.googleFormUrl.trim(),
    slug,
    publicUrl: getCoachPublicUrl(slug),
    status: input.status,
    supportText: input.form.supportText.trim(),
    registerButtonText: input.form.registerButtonText.trim() || "Register Now",
    content,
    analytics: {
      averageVisits: 0,
      conversionRate: "0%",
      dailyVisits: 0,
      deviceBreakdown: {
        desktop: 0,
        mobile: 0,
        tablet: 0
      },
      lastUpdated: "Not connected",
      monthlyVisits: 0,
      region: "Not available",
      source: "Not available",
      totalRegisterClicks: 0,
      totalVisits: 0,
      totalWhatsappClicks: 0,
      videoPlays: 0,
      weeklyVisits: 0
    }
  };
}

export function createFormFromCoachSite(site: CoachSiteRecord): CoachSiteFormState {
  return {
    benefitsText: site.content.benefits.join("\n"),
    bio: site.bio,
    coachEmail: site.coachEmail,
    coachName: site.coachName,
    coachPhone: site.coachPhone,
    coachIntro: site.content.coachIntro,
    ctaText: site.content.ctaText,
    faqText: site.content.faq
      .map((item) => `${item.question}\n${item.answer}`)
      .join("\n\n"),
    googleFormUrl: site.googleFormUrl,
    heroHeadline: site.content.heroHeadline,
    location: site.location,
    logoUrl: site.logoUrl,
    niche: site.niche,
    photoUrl: site.photoUrl,
    registerButtonText: site.registerButtonText,
    slug: site.slug,
    socialCopy: site.content.socialCopy,
    subheadline: site.content.subheadline,
    supportText: site.supportText,
    trustText: site.content.trustText,
    videoUrl: site.videoUrl,
    vision: site.vision,
    visionText: site.content.visionText,
    whatsappLink: site.whatsappLink
  };
}

function parseLines(value: string, fallback: string[]) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : fallback;
}

function parseFaq(value: string) {
  const blocks = value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const parsed = blocks
    .map((block) => {
      const [question, ...answerLines] = block.split(/\r?\n/).map((line) => line.trim());

      return {
        question,
        answer: answerLines.join(" ").trim()
      };
    })
    .filter((item) => item.question && item.answer);

  return parsed.length > 0
    ? parsed
    : [
        {
          question: "What happens after I register?",
          answer: "The register button opens the admin-provided Google Form when configured."
        }
      ];
}
