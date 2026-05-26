"use client";

/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { AmbientBackground } from "@/components/landing/ambient-background";
import { GlassCardInteractions } from "@/components/landing/glass-card-interactions";
import { LiveViewerCount } from "@/components/landing/live-viewer-count";

const ASSET_BASE = "https://img.flexifunnels.com/images/7855";

const imageAssets = {
  whoFor: {
    src: `${ASSET_BASE}/WHOTHISCONSULTATIONISFOR_gyote_1440.png`,
    srcSet: `${ASSET_BASE}/320/WHOTHISCONSULTATIONISFOR_gyote_1440.png 320w, ${ASSET_BASE}/480/WHOTHISCONSULTATIONISFOR_gyote_1440.png 480w, ${ASSET_BASE}/768/WHOTHISCONSULTATIONISFOR_gyote_1440.png 768w, ${ASSET_BASE}/992/WHOTHISCONSULTATIONISFOR_gyote_1440.png 992w, ${ASSET_BASE}/WHOTHISCONSULTATIONISFOR_gyote_1440.png 1200w`,
    alt: "Who this consultation is for"
  },
  logoMark: {
    src: `${ASSET_BASE}/tmpzi9207j3_gzntg_236.webp`,
    alt: "Yours Wellness Center logo mark"
  },
  transformation: {
    src: `${ASSET_BASE}/TheTransformationYouCanExpectblack1_k4otc_1920.jpg`,
    srcSet: `${ASSET_BASE}/320/TheTransformationYouCanExpectblack1_k4otc_1920.jpg 320w, ${ASSET_BASE}/480/TheTransformationYouCanExpectblack1_k4otc_1920.jpg 480w, ${ASSET_BASE}/768/TheTransformationYouCanExpectblack1_k4otc_1920.jpg 768w, ${ASSET_BASE}/992/TheTransformationYouCanExpectblack1_k4otc_1920.jpg 992w, ${ASSET_BASE}/TheTransformationYouCanExpectblack1_k4otc_1920.jpg 1200w`,
    alt: "The transformation you can expect"
  },
  aboutChetan: {
    src: `${ASSET_BASE}/AboutChetan3_awnty_1294.png`,
    srcSet: `${ASSET_BASE}/320/AboutChetan3_awnty_1294.png 320w, ${ASSET_BASE}/480/AboutChetan3_awnty_1294.png 480w, ${ASSET_BASE}/768/AboutChetan3_awnty_1294.png 768w, ${ASSET_BASE}/992/AboutChetan3_awnty_1294.png 992w, ${ASSET_BASE}/AboutChetan3_awnty_1294.png 1200w`,
    alt: "About Chetan"
  }
};

const whatsappTestimonials = [
  {
    src: "/images/testimonials/yours-wellness-testimonial-1.jpeg",
    alt: "WhatsApp testimonial from a Yours Wellness community member about emotional support and renewed hope"
  },
  {
    src: "/images/testimonials/yours-wellness-testimonial-2.jpeg",
    alt: "WhatsApp testimonial from a Yours Wellness community member about lifestyle, energy, and mindset support"
  },
  {
    src: "/images/testimonials/yours-wellness-testimonial-3.jpeg",
    alt: "WhatsApp testimonial from a Yours Wellness community member about PCOD support and confidence"
  }
];

const refundRules = [
  "You join the consultation call on time at your booked slot",
  "You come fully prepared - having filled the pre-call form and watched the training video",
  "You attend from a quiet, distraction-free space",
  "You bring your key decision-maker (spouse/parent/family) on the call with you",
  "You actively communicate during the call so our wellness coach can properly evaluate your case"
];

const differentiators = [
  {
    title: "Root-Cause Fix, Not Symptom Control",
    copy: "We don't suppress your symptoms - we rebuild your hormonal health from the cellular level so PMOS never returns."
  },
  {
    title: "Zero Medications. Zero Side Effects",
    copy: "Our approach is 100% natural. No pills, no OCPs, no hormones - and no dependency."
  },
  {
    title: "1:1 Expert Direction",
    copy: "You get direct guidance from Odisha's trusted hormonal health specialists - not junior staff or automated plans."
  },
  {
    title: "You Become Your Own Coach",
    copy: "We teach you to understand your body, so you never have to depend on doctors, diets, or pills again."
  },
  {
    title: "100% Money-Back Guarantee",
    copy: "If you follow your personalised plan and don't see results, we'll refund your fee in full. The risk is on us."
  }
];

const glassComponents = [
  {
    eyebrow: "01",
    title: "Root-cause diagnosis",
    copy: "A focused 1:1 review of your symptoms, patterns, lifestyle blockers, and next decision point.",
    className: "learning-card"
  },
  {
    eyebrow: "4P",
    title: "Personalised 4-Pillar plan",
    copy: "A clear action map across food, movement, recovery, and tracking so the next step feels practical.",
    className: "method-pillar"
  },
  {
    eyebrow: "60",
    title: "One-call clarity",
    copy: "You leave the session knowing what is likely blocking progress and what to change first.",
    className: "outcomes-card"
  }
];

const masterclassSteps = [
  {
    step: "Step 1",
    heading: "Clearing The Confusion Around Health & Hormones",
    intro: "Understand why so many women feel confused about:",
    bullets: [
      "PMOS",
      "Weight gain",
      "Irregular periods",
      "Hormonal imbalance",
      "Dieting & lifestyle advice"
    ],
    closing: "Learn what actually matters and what creates unnecessary fear and confusion."
  },
  {
    step: "Step 2",
    heading: "Understanding Why Current Healthcare & Lifestyle Patterns Often Fail",
    intro: "Learn why many women:",
    bullets: [
      "Keep facing recurring symptoms",
      "Feel dependent on temporary fixes",
      "Struggle despite trying different diets",
      "Feel mentally exhausted and frustrated"
    ],
    closing:
      "And understand why lifestyle, metabolism, and daily habits also play a major role in healing."
  },
  {
    step: "Step 3",
    heading: "How A Holistic Approach Supports Hormone Healing",
    intro: "Discover how different areas of life are deeply connected to hormones:",
    bullets: [
      "Food & nutrition",
      "Sleep & recovery",
      "Stress & emotions",
      "Physical activity",
      "Mindset & lifestyle habits"
    ],
    closing: "Understand how small sustainable changes can create long-term improvements."
  },
  {
    step: "Step 4",
    heading: "The Root Cause Analysis - 3 Step Method",
    intro: "Learn how to identify possible root causes behind symptoms through:",
    bullets: [
      "Lifestyle pattern analysis",
      "Hormonal & metabolic understanding",
      "Daily habit & stress evaluation"
    ],
    closing: "Instead of only focusing on surface-level symptoms."
  },
  {
    step: "Step 5",
    heading: "Understanding Your Body & Taking Practical Steps To Improve",
    intro: "Get practical strategies, routines, and action steps that can help you:",
    bullets: [
      "Build better lifestyle habits",
      "Support hormonal balance naturally",
      "Improve energy and confidence",
      "Create a sustainable wellness routine",
      "Start your healing journey with clarity"
    ]
  }
];

const masterclassBonus = {
  badge: "Bonus Support & Guidance",
  copy: "Get access to practical implementation guidance, wellness support, and a supportive community throughout your journey."
};

const faqs = [
  {
    question: "Is reversing PMOS possible without medication?",
    answer:
      "Yes, many women have successfully reversed their PMOS symptoms with lifestyle changes, diet, and natural treatments tailored to their needs."
  },
  {
    question: "How can a single consultation call make a difference?",
    answer:
      "In your call, our expert will deeply assess your root causes and design a step-by-step roadmap that's tailored for you. You'll walk away with clarity on what's blocking your progress and the exact next steps to finally move forward."
  },
  {
    question: "What if I've tried everything and nothing worked?",
    answer:
      "Our approach is personalized, considering your unique symptoms and triggers, making it more effective than one-size-fits-all solutions."
  },
  {
    question: "Is this just another diet?",
    answer:
      "No, it's a comprehensive lifestyle approach that includes nutrition, exercise, and stress management tailored to your needs."
  },
  {
    question: "How do I know this will work for me?",
    answer:
      "Our methods are based on a 98% success rate with thousands of women and are customized to your unique condition."
  },
  {
    question: "I don't have time for complex routines.",
    answer:
      "Just 30 minutes a day. Our plan is simple, practical, and designed to fit seamlessly into your routine without adding stress."
  },
  {
    question: "Is this approach backed by science?",
    answer:
      "Yes, the strategies we use are based on the latest research and have been proven to work effectively for PMOS management."
  },
  {
    question: "Will this require a lot of expensive supplements?",
    answer:
      "No, our focus is on natural and sustainable changes, not costly supplements. Any recommendations will be optional and budget-friendly."
  },
  {
    question: "My doctor says PMOS can't be reversed.",
    answer:
      "While some doctors believe PMOS is lifelong, many women have reversed symptoms with lifestyle changes and holistic approaches. Our program focuses on identifying your unique triggers and creating a personalized plan to restore balance naturally."
  }
];

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 8v4l3 3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 2.4 2.4L16 9" />
    </svg>
  );
}

function FunnelImage({
  asset,
  className = ""
}: {
  asset: {
    src: string;
    srcSet?: string;
    alt: string;
  };
  className?: string;
}) {
  return (
    <img
      className={`levelup-image ${className}`}
      src={asset.src}
      srcSet={asset.srcSet}
      sizes="100vw"
      alt={asset.alt}
      loading="lazy"
    />
  );
}

function GuaranteeLine({ dark = false }: { dark?: boolean }) {
  return (
    <p className={`levelup-guarantee ${dark ? "levelup-guarantee--dark" : ""}`}>
      <i>
        We&apos;re so confident in our consultation process - <br />
        if you don&apos;t get the solution in 60 minutes,{" "}
        <strong>we refund you on the spot.</strong>
      </i>
    </p>
  );
}

function CloneCtaButton({
  children = "REGISTER NOW",
  className = "",
  onClick
}: {
  children?: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`levelup-cta ${className}`}
      onClick={onClick}
      data-ripple="liquid"
    >
      <span>{children}</span>
    </button>
  );
}

function SectionImage({
  asset,
  narrow = false,
  children
}: {
  asset: Parameters<typeof FunnelImage>[0]["asset"];
  narrow?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="levelup-section levelup-section--black">
      <div className="levelup-wrap">
        <div
          className={`levelup-image-frame glass-card ${narrow ? "levelup-image-frame--narrow" : ""}`}
        >
          <FunnelImage asset={asset} className={narrow ? "levelup-image--narrow" : ""} />
        </div>
        {children}
      </div>
    </section>
  );
}

function MasterclassWalkthroughSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="levelup-section levelup-masterclass" aria-labelledby="masterclass-title">
      <div className="levelup-wrap levelup-masterclass__inner">
        <div className="levelup-masterclass__header">
          <span className="levelup-masterclass__kicker">Heal Your Hormones Masterclass</span>
          <h2 id="masterclass-title">
            What You&apos;ll Learn Inside The
            <br />
            Heal Your Hormones Masterclass <span aria-hidden="true">🌸</span>
          </h2>
          <p>
            This masterclass is designed to help women understand their body from a deeper hormonal
            and lifestyle perspective - with practical, sustainable, real-life solutions.
          </p>
        </div>

        <div className="levelup-masterclass-progress" aria-label="Five-step learning journey">
          <span className="levelup-masterclass-progress__number">01</span>
          <span className="levelup-masterclass-progress__track" aria-hidden="true">
            <span className="levelup-masterclass-progress__line" />
            <span className="levelup-masterclass-progress__dot" />
            <span className="levelup-masterclass-progress__arrow" />
          </span>
          <span className="levelup-masterclass-progress__number">05</span>
        </div>

        <div className="levelup-masterclass__cards">
          {masterclassSteps.map((card, index) => (
            <article
              className="levelup-masterclass-card"
              key={card.step}
              style={
                {
                  "--walkthrough-index": index,
                  "--walkthrough-depth": `${index % 2 === 0 ? 0 : 8}px`
                } as CSSProperties
              }
            >
              <div className="levelup-masterclass-card__heading">
                <h3>{card.heading}</h3>
                <span className="levelup-masterclass-card__badge">{card.step}</span>
              </div>
              <p>{card.intro}</p>
              <ul>
                {card.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              {card.closing ? (
                <p className="levelup-masterclass-card__closing">{card.closing}</p>
              ) : null}
            </article>
          ))}

          <article
            className="levelup-masterclass-card levelup-masterclass-card--bonus"
            style={
              {
                "--walkthrough-index": masterclassSteps.length,
                "--walkthrough-depth": "4px"
              } as CSSProperties
            }
          >
            <div className="levelup-masterclass-card__heading">
              <h3>Practical Support For Your Healing Journey</h3>
              <span className="levelup-masterclass-card__badge">{masterclassBonus.badge}</span>
            </div>
            <p>{masterclassBonus.copy}</p>
          </article>
        </div>

        <div className="levelup-masterclass__cta">
          <CloneCtaButton onClick={onRegister}>REGISTER NOW</CloneCtaButton>
          <GuaranteeLine />
        </div>
      </div>
    </section>
  );
}

export function LevelupClone() {
  const [secondsLeft, setSecondsLeft] = useState(30 * 60);
  const [slotsLeft, setSlotsLeft] = useState(7);
  const [formViewers, setFormViewers] = useState(23);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  useEffect(() => {
    const countdownTimer = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 30 * 60 : current - 1));
    }, 1000);

    const formTimer = window.setInterval(() => {
      setFormViewers((current) =>
        Math.max(14, Math.min(38, current + (Math.random() > 0.5 ? 1 : -1)))
      );
    }, 3000);

    let slotsTimer: number | undefined;
    const dropSlot = () => {
      setSlotsLeft((current) => (current <= 1 ? current : current - 1));
      slotsTimer = window.setTimeout(dropSlot, (45 + Math.floor(Math.random() * 45)) * 1000);
    };
    slotsTimer = window.setTimeout(dropSlot, (30 + Math.floor(Math.random() * 20)) * 1000);

    let stickyFrame = 0;
    const handleScroll = () => {
      if (stickyFrame) return;

      stickyFrame = window.requestAnimationFrame(() => {
        stickyFrame = 0;
        const hero = document.querySelector<HTMLElement>(".levelup-hero");
        const registration = document.getElementById("registration");
        const footer = document.querySelector<HTMLElement>(".levelup-footer");

        const heroCrossed = hero ? hero.getBoundingClientRect().bottom <= 0 : window.scrollY > 400;
        const registrationReached = registration
          ? registration.getBoundingClientRect().top <= window.innerHeight * 0.82
          : false;
        const footerReached = footer
          ? footer.getBoundingClientRect().top <= window.innerHeight
          : false;

        setStickyVisible(heroCrossed && !registrationReached && !footerReached);
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    const revealCards = Array.from(
      document.querySelectorAll<HTMLElement>(".levelup-masterclass-card")
    );
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let revealObserver: IntersectionObserver | undefined;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealCards.forEach((card) => card.classList.add("is-visible"));
    } else {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver?.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.14 }
      );
      revealCards.forEach((card) => revealObserver?.observe(card));
    }

    return () => {
      window.clearInterval(countdownTimer);
      window.clearInterval(formTimer);
      if (slotsTimer) window.clearTimeout(slotsTimer);
      if (stickyFrame) window.cancelAnimationFrame(stickyFrame);
      revealObserver?.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  function scrollToForm() {
    const form = document.getElementById("flexiOrderForm_wKNos");
    if (!form) return;

    const offset = window.innerWidth <= 768 ? 18 : 28;
    const top = form.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "auto" });
    form.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }

  return (
    <main className="levelup-clone">
      <AmbientBackground />
      <GlassCardInteractions />

      <div className="levelup-topbar">
        <span className="levelup-dot levelup-dot--urgent" aria-hidden="true" />
        Only <strong>{slotsLeft}</strong> slots left this week - <strong>50,000+</strong> women
        already consulted
      </div>

      <div className="levelup-livebar">
        <span className="levelup-dot levelup-dot--live" aria-hidden="true" />
        <LiveViewerCount />
      </div>

      <section className="levelup-hero">
        <div className="levelup-wrap levelup-hero-panel glass-card">
          <div className="levelup-badge">
            <StarIcon />
            Heal Your Hormones by Yours Wellness
          </div>

          <h1 className="levelup-title">
            Heal Your Hormones With A Practical <span>PMOS Reset</span>
          </h1>

          <p className="levelup-subtitle">
            A simple lifestyle-led masterclass for women who want better periods, energy, mood,
            weight management, and hormonal balance without starvation diets or exhausting workouts.
            <br />
            <br />
            Learn the Magical 5-Step Hormone Reset Method from Yours Wellness Center and leave with
            a clear, practical direction you can actually follow.
          </p>

          <div className="levelup-video glass-card" aria-label="Consultation preview video">
            <iframe
              src="https://api.vadoo.tv/iframe_test?id=PLJpSMhwLlnaLYI9N9WXiL3hwhrdaKDH"
              title="PMOS consultation training video"
              allow="autoplay; fullscreen"
              loading="lazy"
              allowFullScreen
            />
          </div>

          <div className="levelup-countdown glass-card" aria-label="Offer expiry countdown">
            <div className="levelup-countdown__label">
              <ClockIcon />
              Offer Expires In
            </div>
            <div className="levelup-countdown__units">
              <div>
                <strong>{minutes}</strong>
                <span>Minutes</span>
              </div>
              <div>
                <strong>{seconds}</strong>
                <span>Seconds</span>
              </div>
            </div>
          </div>

          <CloneCtaButton onClick={scrollToForm}>REGISTER NOW</CloneCtaButton>

          <div className="levelup-note">
            <CheckIcon />
            100% money-back guarantee if you&apos;re not satisfied
          </div>
          <div className="levelup-spots">
            <span className="levelup-dot levelup-dot--pink" aria-hidden="true" />
            <strong>Only {slotsLeft} spots</strong>&nbsp;left for this week
          </div>
        </div>
      </section>

      <section className="levelup-section levelup-glass-components" aria-label="Consultation plan">
        <div className="levelup-wrap">
          <div className="levelup-glass-grid">
            {glassComponents.map((item) => (
              <article className={`levelup-production-card ${item.className}`} key={item.title}>
                <span className="method-icon levelup-production-card__eyebrow" aria-hidden="true">
                  {item.eyebrow}
                </span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="levelup-section levelup-section--pink-note">
        <div className="levelup-wrap">
          <GuaranteeLine />
        </div>
      </section>

      <MasterclassWalkthroughSection onRegister={scrollToForm} />

      <section className="levelup-section levelup-testimonials" id="testimonials">
        <div className="levelup-wrap">
          <h2>
            Real Messages From Women
            <br />
            In Our <u>Wellness Community</u>
          </h2>
          <div className="levelup-whatsapp-testimonial-grid">
            {whatsappTestimonials.map((testimonial) => (
              <figure className="levelup-whatsapp-testimonial glass-card" key={testimonial.src}>
                <img src={testimonial.src} alt={testimonial.alt} loading="lazy" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <SectionImage asset={imageAssets.whoFor}>
        <CloneCtaButton onClick={scrollToForm} />
        <GuaranteeLine dark />
      </SectionImage>

      <section className="levelup-section levelup-refund">
        <div className="levelup-wrap levelup-wrap--narrow levelup-text-card glass-card">
          <FunnelImage asset={imageAssets.logoMark} className="levelup-logo-mark" />
          <h2>Refund Eligibility for the Consultation Call</h2>
          <p>You will be eligible for a full refund of your consultation fee if -</p>
          <ul>
            {refundRules.map((rule) => (
              <li key={rule}>
                <span aria-hidden="true">✓</span>
                {rule}
              </li>
            ))}
          </ul>
          <div className="levelup-refund__notice">
            If these conditions are met and you are not satisfied with the consultation call
            experience,
            <br />
            <br />
            We will refund your consultation fee in full - <strong>no questions asked.</strong>
            <br />
            <br />
            <strong>Please note -</strong>
            <br />
            <br />
            If you no-show, arrive late, or attend unprepared, you will not be eligible for a
            refund.
            <br />
            <br />
            Missed calls cannot be rescheduled
          </div>
          <CloneCtaButton onClick={scrollToForm} />
          <GuaranteeLine dark />
        </div>
      </section>

      <SectionImage asset={imageAssets.transformation}>
        <CloneCtaButton onClick={scrollToForm} />
      </SectionImage>

      <section className="levelup-section levelup-difference">
        <div className="levelup-wrap levelup-wrap--text levelup-text-card glass-card">
          <h2>Why Yours Wellness Center Is Different From Quick-Fix Advice</h2>
          <p>
            Every other approach tries to control your symptoms.
            <br />
            We built the only system designed to eliminate the root cause.
            <br />- While most clinics <strong>prescribe pills</strong> and hormones to{" "}
            <strong>force periods</strong>
            <br />- Give <strong>generic diets</strong> that crash your energy
            <br />- offer temporary relief without long-term change.
            <br />
            <br />
            <strong>We do the opposite.</strong>
          </p>
          <ul>
            {differentiators.map((item) => (
              <li key={item.title}>
                <span aria-hidden="true">»</span>
                <div>
                  <strong>{item.title} - </strong>
                  {item.copy}
                </div>
              </li>
            ))}
          </ul>
          <CloneCtaButton onClick={scrollToForm} />
          <GuaranteeLine />
        </div>
      </section>

      <SectionImage asset={imageAssets.aboutChetan}>
        <CloneCtaButton onClick={scrollToForm} />
      </SectionImage>

      <section className="levelup-section levelup-checkout-section" id="registration">
        <div className="levelup-wrap">
          <form
            id="flexiOrderForm_wKNos"
            className="levelup-form glass-card pricing-card"
            onSubmit={(event) => {
              event.preventDefault();
              setFormMessage(
                "Thank you. Your details are ready. Our team will confirm your registration and payment slot shortly."
              );
            }}
          >
            <div className="levelup-form__secure">Secure Checkout</div>
            <div className="levelup-form__inner">
              <div className="levelup-savings">
                You&apos;re saving <s>₹1,999</s> <strong>₹1,948 today</strong> - Limited Time
              </div>
              <input
                type="text"
                name="first_name"
                placeholder="First Name"
                aria-label="First Name"
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Email ID"
                aria-label="Email ID"
                required
              />
              <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                aria-label="Phone Number"
                required
              />

              <table className="levelup-product-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Heal Your Hormones Registration</td>
                    <td>₹51</td>
                  </tr>
                </tbody>
              </table>

              <button className="levelup-order-button" type="submit" data-ripple="liquid">
                REGISTER NOW <span aria-hidden="true">›</span>
              </button>
              {formMessage ? <p className="levelup-form-message">{formMessage}</p> : null}

              <div className="levelup-trust-row" aria-label="Checkout trust signals">
                <span>SSL Secured</span>
                <i />
                <span>Instant Access</span>
                <i />
                <span>Money-Back</span>
              </div>
              <div className="levelup-form-viewers">
                <span className="levelup-dot levelup-dot--live" aria-hidden="true" />
                <strong>{formViewers}</strong> people viewing this right now
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="levelup-section levelup-faq">
        <div className="levelup-wrap">
          <h2>FREQUENTLY ASKED QUESTIONS</h2>
          <div className="levelup-divider" />
          <div className="levelup-faq-list">
            {faqs.map((faq) => (
              <details key={faq.question} className="levelup-faq-item faq-item">
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <aside
        className={`levelup-sticky-cta glass-card ${stickyVisible ? "is-visible" : ""}`}
        aria-label="Sticky checkout offer"
        aria-hidden={!stickyVisible}
      >
        <div className="levelup-sticky-offer">
          <div className="levelup-sticky-price">
            <del>₹1,999</del>
            <strong>
              ₹51 <small>only</small>
            </strong>
          </div>
          <div
            className="levelup-sticky-countdown"
            aria-label={`Offer expires in ${minutes} minutes ${seconds} seconds`}
          >
            <ClockIcon />
            <span>Offer expires in</span>
            <strong>
              {minutes}:{seconds}
            </strong>
          </div>
        </div>
        <i className="levelup-sticky-divider" />
        <CloneCtaButton onClick={scrollToForm}>REGISTER NOW</CloneCtaButton>
        <i className="levelup-sticky-divider" />
        <div className="levelup-sticky-spots">
          <span className="levelup-dot levelup-dot--pink" aria-hidden="true" />
          Only <strong>{slotsLeft}</strong> spots left
        </div>
      </aside>

      <footer className="levelup-footer" aria-label="Yours Wellness compliance footer">
        <div className="levelup-footer__inner">
          <div className="levelup-footer__brand">
            <span>Yours Wellness Center</span>
            <strong>Holistic hormone reset support for women</strong>
          </div>
          <nav className="levelup-footer__links" aria-label="Legal links">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms</a>
            <a href="/refund">Refund Policy</a>
            <a href="/disclaimer">Disclaimer</a>
          </nav>
          <p className="levelup-footer__copy">
            Copyright 2026 | Yours Wellness Center. All rights reserved.
          </p>
          <p className="levelup-footer__disclaimer">
            This page is for wellness education and lifestyle coaching support. It is not a
            substitute for medical advice, diagnosis, or treatment. Results vary based on individual
            health history, lifestyle, and consistency.
          </p>
          <p className="levelup-footer__disclaimer">
            NOT FACEBOOK: This site is not part of Facebook or Meta Platforms, Inc. It is not
            endorsed by Facebook in any way. Facebook is a trademark of Meta Platforms, Inc.
          </p>
        </div>
      </footer>
    </main>
  );
}
