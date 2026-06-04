export const YW_ROOT_REDIRECT_URL = "https://yourswellness.in";
export const BLOCKED_LINK_MESSAGE =
  "This link is not available. Please use the link shared by your coach.";

export type CoachStatus = "active" | "inactive";
export type FunnelStatus = "active" | "inactive";
export type FunnelType = "guest" | "paidProgram";

export type GuestProfile = {
  about: string[];
  audience: {
    description: string;
    painPoints: string[];
    title: string;
  };
  benefits: Array<{
    copy: string;
    title: string;
  }>;
  buttonLabel: string;
  coachIntro: {
    credibility: string;
    expertise: string;
    story: string;
    trustLine: string;
  };
  description: string;
  finalCta: {
    copy: string;
    title: string;
  };
  headline: string;
  hook: string;
  imageAlt: string;
  imageSrc: string;
  method: Array<{
    copy: string;
    step: string;
    title: string;
  }>;
  niche: string;
  registerUrl?: string;
  subheadline: string;
  theme: "diabetes" | "fitness" | "mental-wellness" | "pcos" | "weight-loss";
  trust: {
    cards: Array<{
      label: string;
      value: string;
    }>;
    note: string;
  };
  videoEmbedUrl?: string;
};

export type Coach = {
  displayName: string;
  guestProfile: GuestProfile;
  id: string;
  slug: string;
  status: CoachStatus;
};

export type Funnel = {
  allowedPaths: string[];
  canonicalPath: string;
  coachId: string;
  displayName: string;
  entryCode: string;
  id: string;
  paymentUrl?: string;
  status: FunnelStatus;
  successPath?: string;
  thankYouVideoUrl?: string;
  type: FunnelType;
};

export const coaches: Coach[] = [
  {
    id: "coach-gyana",
    slug: "gyana",
    displayName: "Gyana Ranjan",
    status: "active",
    guestProfile: {
      niche: "PCOS / Women Wellness",
      theme: "pcos",
      hook: "For women tired of guessing what their hormones are trying to say.",
      headline: "Understand your hormones with calm, practical lifestyle guidance.",
      subheadline:
        "Work with Gyana Ranjan to make sense of cycle patterns, energy shifts, cravings, weight changes, mood, and daily routines through supportive education and habit guidance.",
      description:
        "A practical wellness coach helping women understand hormones, lifestyle patterns, energy, weight, periods, and long-term habit change with a clear plan.",
      about: [
        "Gyana Ranjan works with women who want structured lifestyle guidance instead of confusing quick fixes.",
        "His coaching approach focuses on simple routines, root-cause clarity, and practical next steps that fit real life."
      ],
      coachIntro: {
        expertise: "Women's hormonal wellness, PCOS lifestyle support, habit coaching",
        credibility: "Yours Wellness coach focused on practical education and guided routines",
        story:
          "Gyana helps women slow down the noise around PCOS and wellness advice, then rebuild a clear routine around food, movement, rest, tracking, and consistency.",
        trustLine:
          "Every recommendation stays education-first and should work alongside medical guidance where needed."
      },
      audience: {
        title: "Who this guest session is for",
        description:
          "A supportive starting point for women who want clarity before committing to a deeper program.",
        painPoints: [
          "Irregular periods, PMS, acne, cravings, or energy crashes that feel difficult to connect",
          "Trying diet changes but not knowing which routine is sustainable",
          "Feeling overwhelmed by conflicting PCOS or hormone advice online",
          "Wanting a coach-led plan that respects real-life work, family, and stress"
        ]
      },
      benefits: [
        {
          title: "Hormone pattern clarity",
          copy: "Understand common lifestyle patterns that may influence energy, cycle regularity, mood, and cravings."
        },
        {
          title: "Simple routine direction",
          copy: "Get a practical view of food, movement, sleep, and tracking habits that can support better consistency."
        },
        {
          title: "Supportive next step",
          copy: "Know whether a guided program, medical review, or habit reset is the right next move for you."
        }
      ],
      method: [
        {
          step: "01",
          title: "Listen to the body signals",
          copy: "Start by mapping symptoms, routine gaps, stress, sleep, food timing, and cycle observations."
        },
        {
          step: "02",
          title: "Connect patterns gently",
          copy: "Identify what may be affecting consistency without blaming willpower or pushing extremes."
        },
        {
          step: "03",
          title: "Build the next routine",
          copy: "Work towards realistic lifestyle changes that can be monitored and adjusted under guidance."
        }
      ],
      trust: {
        cards: [
          {
            value: "YW",
            label: "NutriTech-powered coaching framework"
          },
          {
            value: "3-step",
            label: "Simple clarity-first lifestyle method"
          },
          {
            value: "Safe",
            label: "Education-first, doctor-friendly guidance"
          }
        ],
        note: "This guest page is for education and lifestyle guidance. It does not replace medical advice, diagnosis, or treatment."
      },
      finalCta: {
        title: "Ready for a clearer first step?",
        copy: "Join Gyana's guest session when the joining link is available and start with practical, supportive hormone education."
      },
      imageSrc: "/images/coach-gyana-ranjan.png",
      imageAlt: "Coach Gyana Ranjan, women's hormonal health coach",
      videoEmbedUrl:
        "https://www.youtube.com/embed/gBQoms47fB8?playsinline=1&controls=1&rel=0&modestbranding=1",
      buttonLabel: "Join Guest Session"
    }
  }
];

export const funnels: Funnel[] = [
  {
    id: "gyana-guest",
    coachId: "coach-gyana",
    displayName: "Gyana Guest",
    type: "guest",
    entryCode: "gyana-guest",
    canonicalPath: "/gyana",
    allowedPaths: ["/gyana"],
    status: "active"
  },
  {
    id: "gyana-pcos-51",
    coachId: "coach-gyana",
    displayName: "Gyana PCOS 51",
    type: "paidProgram",
    entryCode: "gyana-pcos-51",
    canonicalPath: "/gyana/pcos-51",
    allowedPaths: ["/gyana/pcos-51", "/gyana/pcos-51/success"],
    successPath: "/gyana/pcos-51/success",
    thankYouVideoUrl: "https://youtu.be/fLSSje0nCHk?si=6cTvc3XKAJGZoD-5",
    status: "active"
  }
];

export function getCoachById(coachId: string) {
  return coaches.find((coach) => coach.id === coachId && coach.status === "active") ?? null;
}

export function getCoachBySlug(slug: string) {
  return coaches.find((coach) => coach.slug === slug && coach.status === "active") ?? null;
}

export function getFunnelById(funnelId: string) {
  return funnels.find((funnel) => funnel.id === funnelId && funnel.status === "active") ?? null;
}

export function getFunnelByEntryCode(entryCode: string) {
  return (
    funnels.find((funnel) => funnel.entryCode === entryCode && funnel.status === "active") ?? null
  );
}

export function getFunnelForPath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);

  return (
    funnels.find(
      (funnel) =>
        funnel.status === "active" &&
        funnel.allowedPaths.some((allowedPath) => normalizePathname(allowedPath) === normalizedPath)
    ) ?? null
  );
}

export function isPathAllowedForFunnel(funnel: Funnel, pathname: string) {
  const normalizedPath = normalizePathname(pathname);

  return funnel.allowedPaths.some(
    (allowedPath) => normalizePathname(allowedPath) === normalizedPath
  );
}

export function isPaidProgramFunnel(funnel: Funnel | null): funnel is Funnel & {
  successPath: string;
} {
  return Boolean(
    funnel &&
    funnel.type === "paidProgram" &&
    funnel.successPath &&
    funnel.status === "active"
  );
}

export function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";

  const withoutTrailingSlash = pathname.replace(/\/+$/, "");

  return withoutTrailingSlash || "/";
}
