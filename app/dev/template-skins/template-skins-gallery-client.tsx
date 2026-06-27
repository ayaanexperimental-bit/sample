"use client";

import { useEffect, useMemo, useState } from "react";

import { PublicCoachSitePage } from "../../../components/coach/public-coach-site-page";
import { approvedCoachSites } from "../../../lib/admin-coach-sites";
import { buildCoachSiteFromShopState } from "../../../lib/shop-builder";
import {
  getProductionReadyCoachTemplateThemes,
  type CoachTemplateThemeId
} from "../../../lib/coach-template-themes";
import styles from "./template-skins-gallery.module.css";

type GalleryViewport = "desktop" | "mobile" | "tablet";

const gallerySkins = getProductionReadyCoachTemplateThemes();
const GALLERY_REGISTER_URL = "https://example.com/coach-register";

const sampleStates = [
  {
    coachName: "Gyana Ranjan",
    contactLink: GALLERY_REGISTER_URL,
    location: "Bhubaneswar",
    niche: "PCOS hormone wellness",
    shortBio: "Education-first lifestyle support for hormone-supportive routines.",
    slug: "gyana-ranjan"
  },
  {
    coachName: "Ayaan Malik",
    contactLink: GALLERY_REGISTER_URL,
    location: "Mumbai",
    niche: "Fat loss habits",
    shortBio: "Practical nutrition and habit coaching without body-shaming."
  },
  {
    coachName: "Priya Menon",
    contactLink: GALLERY_REGISTER_URL,
    location: "Kochi",
    niche: "Gut health and digestion",
    shortBio: "Calm gut-friendly routines with education-first coaching."
  },
  {
    coachName: "Neha Kapoor",
    contactLink: GALLERY_REGISTER_URL,
    location: "Delhi",
    niche: "Sleep recovery coaching",
    shortBio: "Supportive evening-routine coaching for better lifestyle rhythm."
  },
  {
    coachName: "Rohan Sen",
    contactLink: GALLERY_REGISTER_URL,
    location: "Pune",
    niche: "Fitness and strength habits",
    shortBio: "Strength and consistency coaching for busy professionals."
  },
  {
    coachName: "Meera Das",
    contactLink: GALLERY_REGISTER_URL,
    location: "Kolkata",
    niche: "General wellness",
    shortBio: "Simple daily wellness systems with grounded support."
  },
  {
    coachName: "Dr. Ananya Ramanathan Wellness Education Collective",
    contactLink: GALLERY_REGISTER_URL,
    location: "Chennai",
    niche: "Metabolic and lifestyle wellness",
    shortBio:
      "Long-name stress test for premium coach pages with detailed lifestyle education and support."
  },
  {
    coachName: "Minimal Data Coach",
    contactLink: GALLERY_REGISTER_URL,
    location: "",
    niche: "Wellness",
    shortBio: "Minimal details."
  }
];

const sampleSites = sampleStates.map((state, index) =>
  buildCoachSiteFromShopState({
    id: `template-gallery-${index}`,
    published: true,
    state
  })
);

function getPublicGallerySite(skinId: CoachTemplateThemeId, sampleIndex: number) {
  const baseSite =
    sampleIndex === 0
      ? {
          ...approvedCoachSites[0],
          googleFormUrl: approvedCoachSites[0]?.googleFormUrl || GALLERY_REGISTER_URL
        }
      : sampleSites[sampleIndex] || sampleSites[0];

  return {
    ...baseSite,
    selectedThemeId: skinId
  };
}

function getDefaultGalleryState() {
  return {
    embedMode: false,
    sampleIndex: 0,
    skinId: gallerySkins[0].id,
    viewport: "desktop" as GalleryViewport
  };
}

function getBrowserGalleryState() {
  if (typeof window === "undefined") return getDefaultGalleryState();
  const params = new URLSearchParams(window.location.search);
  const requestedSkinId = params.get("skin");
  const requestedSampleIndex = Number(params.get("sample"));
  const requestedViewport = params.get("viewport");
  const skin = gallerySkins.find((item) => item.id === requestedSkinId) || gallerySkins[0];

  return {
    embedMode: params.get("embed") === "1",
    sampleIndex:
      Number.isInteger(requestedSampleIndex) &&
      requestedSampleIndex >= 0 &&
      requestedSampleIndex < sampleStates.length
        ? requestedSampleIndex
        : 0,
    skinId: skin.id,
    viewport:
      requestedViewport === "mobile" || requestedViewport === "tablet"
        ? requestedViewport
        : ("desktop" as GalleryViewport)
  };
}

export function TemplateSkinsGalleryClient() {
  const [embedMode, setEmbedMode] = useState(false);
  const [skinId, setSkinId] = useState<CoachTemplateThemeId>(gallerySkins[0].id);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [viewport, setViewport] = useState<GalleryViewport>("desktop");
  const skin = gallerySkins.find((item) => item.id === skinId) || gallerySkins[0];
  const site = useMemo(() => getPublicGallerySite(skin.id, sampleIndex), [sampleIndex, skin.id]);

  useEffect(() => {
    const nextState = getBrowserGalleryState();
    const frame = window.requestAnimationFrame(() => {
      setEmbedMode(nextState.embedMode);
      setSampleIndex(nextState.sampleIndex);
      setSkinId(nextState.skinId);
      setViewport(nextState.viewport);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (embedMode) {
    return (
      <main className={styles.embedShell} data-template-skin-embed="true">
        <PublicCoachSitePage
          enableTracking={false}
          previewMode
          site={site}
          stickyMode="contained"
        />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Template skin gallery controls">
        <div>
          <span className={styles.eyebrow}>Internal QA</span>
          <h1>Coach Template Skins</h1>
          <p>Development-only gallery for visual, responsive, and inspect-safety review.</p>
        </div>

        <label>
          <span>Skin</span>
          <select
            aria-label="Choose template skin"
            onChange={(event) => setSkinId(event.target.value as CoachTemplateThemeId)}
            value={skin.id}
          >
            {gallerySkins.map((item) => (
              <option key={item.id} value={item.id}>
                {item.publicName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Test coach</span>
          <select
            aria-label="Choose test coach"
            onChange={(event) => setSampleIndex(Number(event.target.value))}
            value={sampleIndex}
          >
            {sampleStates.map((item, index) => (
              <option key={`${item.coachName}-${index}`} value={index}>
                {item.coachName} - {item.niche}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.viewportButtons} aria-label="Preview viewport">
          {(["desktop", "tablet", "mobile"] as const).map((item) => (
            <button
              data-active={viewport === item ? "true" : "false"}
              key={item}
              onClick={() => setViewport(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <dl className={styles.meta}>
          <div>
            <dt>Status</dt>
            <dd>{skin.status}</dd>
          </div>
          <div>
            <dt>Background</dt>
            <dd>{skin.background.type}</dd>
          </div>
          <div>
            <dt>Motion</dt>
            <dd>{skin.motion.level}</dd>
          </div>
          <div>
            <dt>Hero</dt>
            <dd>{skin.layout.heroVariant}</dd>
          </div>
          <div>
            <dt>Bonus</dt>
            <dd>{skin.layout.bonusVariant}</dd>
          </div>
          <div>
            <dt>FAQ</dt>
            <dd>{skin.layout.faqVariant}</dd>
          </div>
        </dl>

        <p className={styles.note}>{skin.visualDifference.evidence}</p>
      </aside>

      <section className={styles.previewColumn} aria-label="Template skin preview">
        <div className={styles.previewHeader}>
          <div>
            <strong>{skin.publicName}</strong>
            <span>{site.coachName}</span>
          </div>
          <code>{skin.id}</code>
        </div>
        <div className={styles.previewFrame} data-size={viewport}>
          <PublicCoachSitePage
            enableTracking={false}
            previewMode
            site={site}
            stickyMode="contained"
          />
        </div>
      </section>
    </main>
  );
}
