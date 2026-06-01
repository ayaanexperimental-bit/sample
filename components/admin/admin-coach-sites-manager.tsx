"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  EMPTY_COACH_SITE_FORM,
  type CoachSiteFormState,
  type CoachSiteRecord,
  type CoachSiteStatus,
  createCoachSiteFromForm,
  createFormFromCoachSite,
  demoCoachSites,
  getCoachPublicUrl,
  normalizeCoachSlug
} from "../../lib/admin-coach-sites";
import styles from "./admin-dashboard-shell.module.css";

const statusOptions: Array<"all" | CoachSiteStatus> = [
  "all",
  "draft",
  "published",
  "paused",
  "archived",
  "removed"
];

const removalReasons = [
  "inactive coach",
  "duplicate site",
  "wrong details",
  "coach left program",
  "other"
];

export function AdminCoachSitesManager({ csrfToken }: { csrfToken: string }) {
  const [sites, setSites] = useState<CoachSiteRecord[]>(demoCoachSites);
  const [form, setForm] = useState<CoachSiteFormState>(EMPTY_COACH_SITE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewSite, setPreviewSite] = useState<CoachSiteRecord | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CoachSiteStatus>("all");
  const [message, setMessage] = useState("");
  const [creationMessage, setCreationMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<CoachSiteRecord | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [removeReason, setRemoveReason] = useState(removalReasons[0]);

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sites.filter((site) => {
      const matchesStatus = statusFilter === "all" || site.status === statusFilter;
      const matchesSearch =
        !query ||
        site.coachName.toLowerCase().includes(query) ||
        site.niche.toLowerCase().includes(query) ||
        site.slug.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [search, sites, statusFilter]);

  function updateFormField<Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleCoachNameChange(value: string) {
    setForm((current) => ({
      ...current,
      coachName: value,
      slug: current.slug ? current.slug : normalizeCoachSlug(value)
    }));
  }

  function buildPreviewSite(status: CoachSiteStatus) {
    const slug = normalizeCoachSlug(form.slug || form.coachName);

    return createCoachSiteFromForm({
      form: {
        ...form,
        slug
      },
      id: editingId || `coach-site-${slug || "draft"}`,
      status
    });
  }

  function handleGenerateSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const slug = normalizeCoachSlug(form.slug || form.coachName);
    if (!form.coachName.trim() || !form.niche.trim() || !slug) {
      setMessage("Coach name, coach niche, and referral slug are required.");
      return;
    }

    setCreationMessage("Creating coach website...");
    window.setTimeout(() => {
      setCreationMessage("Generating niche-based content...");
    }, 220);
    window.setTimeout(() => {
      const site = buildPreviewSite("draft");
      setPreviewSite(site);
      setCreationMessage("Preparing preview complete. Review before publishing.");
      setForm((current) => ({
        ...current,
        slug: site.slug
      }));
    }, 520);
  }

  function saveSite(status: CoachSiteStatus) {
    const site = previewSite ? { ...previewSite, status } : buildPreviewSite(status);
    const existingIndex = sites.findIndex((item) => item.id === site.id || item.slug === site.slug);
    const nextSites =
      existingIndex >= 0
        ? sites.map((item, index) => (index === existingIndex ? site : item))
        : [site, ...sites];

    setSites(nextSites);
    setPreviewSite(site);
    setEditingId(site.id);
    setMessage(
      status === "published"
        ? `Successfully Published. Stable public link: ${site.publicUrl}`
        : `Draft saved. Stable public link reserved: ${site.publicUrl}`
    );
  }

  async function handleGenerateWithAi() {
    setAiMessage("");
    setMessage("");

    if (!form.coachName.trim() || !form.niche.trim()) {
      setAiMessage("Coach name and coach niche are required before AI generation.");
      return;
    }

    setAiSubmitting(true);
    setAiMessage("Generating niche-based content...");

    window.setTimeout(() => {
      setAiMessage((current) =>
        current === "Generating niche-based content..."
          ? "Preparing coach site copy..."
          : current
      );
    }, 450);

    try {
      const response = await fetch("/api/admin/coach-sites/generate-copy", {
        body: JSON.stringify({
          bio: form.bio,
          coachName: form.coachName,
          location: form.location,
          niche: form.niche,
          vision: form.vision
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        content?: {
          benefits?: string[];
          coachIntro?: string;
          ctaText?: string;
          faq?: Array<{
            answer: string;
            question: string;
          }>;
          heroHeadline?: string;
          socialCopy?: string;
          subheadline?: string;
          trustText?: string;
          visionText?: string;
        };
        message?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.content) {
        setAiMessage(payload.message || "AI generation not configured yet.");
        return;
      }

      setForm((current) => ({
        ...current,
        benefitsText: payload.content?.benefits?.join("\n") || current.benefitsText,
        coachIntro: payload.content?.coachIntro || current.coachIntro,
        ctaText: payload.content?.ctaText || current.ctaText,
        faqText:
          payload.content?.faq
            ?.map((item) => `${item.question}\n${item.answer}`)
            .join("\n\n") || current.faqText,
        heroHeadline: payload.content?.heroHeadline || current.heroHeadline,
        registerButtonText: payload.content?.ctaText || current.registerButtonText,
        socialCopy: payload.content?.socialCopy || current.socialCopy,
        subheadline: payload.content?.subheadline || current.subheadline,
        trustText: payload.content?.trustText || current.trustText,
        visionText: payload.content?.visionText || current.visionText
      }));
      setAiMessage("AI copy prepared. Review and edit before publishing.");
    } catch {
      setAiMessage("AI copy generation failed.");
    } finally {
      setAiSubmitting(false);
    }
  }

  function editSite(site: CoachSiteRecord) {
    setEditingId(site.id);
    setForm(createFormFromCoachSite(site));
    setPreviewSite(site);
    setMessage(`Editing ${site.coachName}. Changing slug will change the public link.`);
  }

  function updateSiteStatus(site: CoachSiteRecord, status: CoachSiteStatus) {
    setSites((current) => current.map((item) => (item.id === site.id ? { ...item, status } : item)));
    setPreviewSite((current) => (current?.id === site.id ? { ...current, status } : current));
    setMessage(
      status === "paused"
        ? `${site.coachName} paused. Public link remains ${site.publicUrl}.`
        : `${site.coachName} resumed with the same public link: ${site.publicUrl}.`
    );
  }

  async function copyPublicLink(site: CoachSiteRecord) {
    const link =
      typeof window === "undefined" ? site.publicUrl : new URL(site.publicUrl, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(link);
      setMessage(`Copied public link: ${site.publicUrl}`);
    } catch {
      setMessage(`Public link: ${site.publicUrl}`);
    }
  }

  function resetCreateFlow() {
    setForm(EMPTY_COACH_SITE_FORM);
    setEditingId(null);
    setPreviewSite(null);
    setCreationMessage("");
    setMessage("");
  }

  return (
    <>
      <section className={styles.section} id="coach-sites" aria-labelledby="coach-sites-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Coach Sites</p>
            <h2 id="coach-sites-title">Referral website list</h2>
          </div>
          <span className={styles.sampleBadge}>Demo/local state</span>
        </div>
        <p className={styles.inlineNote}>
          Coach public links are shareable. Analytics, edit access, private settings, and future
          write APIs remain admin-only.
        </p>

        <div className={styles.coachFilters}>
          <label className={styles.compactField}>
            <span>Search coaches</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, niche, or slug"
              type="search"
              value={search}
            />
          </label>
          <label className={styles.compactField}>
            <span>Status</span>
            <select
              onChange={(event) => setStatusFilter(event.target.value as "all" | CoachSiteStatus)}
              value={statusFilter}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Coach</th>
                <th>Niche</th>
                <th>Status</th>
                <th>Public link</th>
                <th>Visits</th>
                <th>Register clicks</th>
                <th>Conversion</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => (
                <tr key={site.id}>
                  <td>{site.coachName}</td>
                  <td>{site.niche}</td>
                  <td>
                    <span className={styles.statusBadge} data-status={site.status}>
                      {site.status}
                    </span>
                  </td>
                  <td>
                    <code>{site.publicUrl}</code>
                  </td>
                  <td>{site.analytics.totalVisits.toLocaleString()}</td>
                  <td>{site.analytics.totalRegisterClicks.toLocaleString()}</td>
                  <td>{site.analytics.conversionRate}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button onClick={() => setPreviewSite(site)} type="button">
                        Preview
                      </button>
                      <button onClick={() => editSite(site)} type="button">
                        Edit
                      </button>
                      <button onClick={() => void copyPublicLink(site)} type="button">
                        Copy Link
                      </button>
                      {site.status === "paused" ? (
                        <button onClick={() => updateSiteStatus(site, "published")} type="button">
                          Resume
                        </button>
                      ) : (
                        <button onClick={() => updateSiteStatus(site, "paused")} type="button">
                          Pause
                        </button>
                      )}
                      <button onClick={() => setRemoveCandidate(site)} type="button">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={styles.section}
        id="create-coach-site"
        aria-labelledby="create-coach-site-title"
      >
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Create Coach Site</p>
            <h2 id="create-coach-site-title">Fixed-template referral page creator</h2>
          </div>
          <button className={styles.secondaryAction} onClick={resetCreateFlow} type="button">
            New Draft
          </button>
        </div>
        <p className={styles.inlineNote}>
          Template layout is fixed. Admin can change coach content, links, image/logo, video, CTA
          text, Google Form URL, WhatsApp link, and manually editable copy only.
        </p>
        <p className={styles.inlineNote}>
          AI generates copy only. It cannot modify design, backend logic, routes, database schema, or
          security settings.
        </p>

        <form className={styles.coachForm} onSubmit={handleGenerateSite}>
          <div className={styles.formGrid}>
            <TextField
              label="Coach name"
              onChange={handleCoachNameChange}
              required
              value={form.coachName}
            />
            <TextField
              label="Coach niche"
              onChange={(value) => updateFormField("niche", value)}
              required
              value={form.niche}
            />
            <TextField
              label="Coach location"
              onChange={(value) => updateFormField("location", value)}
              value={form.location}
            />
            <TextField
              label="Referral slug"
              onChange={(value) => updateFormField("slug", normalizeCoachSlug(value))}
              required
              value={form.slug}
            />
            <TextField
              label="Coach email"
              onChange={(value) => updateFormField("coachEmail", value)}
              type="email"
              value={form.coachEmail}
            />
            <TextField
              label="Coach phone"
              onChange={(value) => updateFormField("coachPhone", value)}
              value={form.coachPhone}
            />
            <TextField
              label="Google Form registration link"
              onChange={(value) => updateFormField("googleFormUrl", value)}
              type="url"
              value={form.googleFormUrl}
            />
            <TextField
              label="WhatsApp link"
              onChange={(value) => updateFormField("whatsappLink", value)}
              type="url"
              value={form.whatsappLink}
            />
            <TextField
              label="Coach photo/logo URL"
              onChange={(value) => updateFormField("photoUrl", value)}
              type="url"
              value={form.photoUrl}
            />
            <TextField
              label="Intro video link"
              onChange={(value) => updateFormField("videoUrl", value)}
              type="url"
              value={form.videoUrl}
            />
            <TextField
              label="Register button text"
              onChange={(value) => updateFormField("registerButtonText", value)}
              value={form.registerButtonText}
            />
          </div>

          <TextAreaField
            label="Coach short bio"
            onChange={(value) => updateFormField("bio", value)}
            value={form.bio}
          />
          <TextAreaField
            label="Coach vision/mission"
            onChange={(value) => updateFormField("vision", value)}
            value={form.vision}
          />
          <TextAreaField
            label="Contact support text"
            onChange={(value) => updateFormField("supportText", value)}
            placeholder="Need help? Contact your coach directly."
            value={form.supportText}
          />

          <div className={styles.copyEditorGrid}>
            <TextAreaField
              label="Hero headline"
              onChange={(value) => updateFormField("heroHeadline", value)}
              value={form.heroHeadline}
            />
            <TextAreaField
              label="Subheadline"
              onChange={(value) => updateFormField("subheadline", value)}
              value={form.subheadline}
            />
            <TextAreaField
              label="Coach introduction"
              onChange={(value) => updateFormField("coachIntro", value)}
              value={form.coachIntro}
            />
            <TextAreaField
              label="Vision statement"
              onChange={(value) => updateFormField("visionText", value)}
              value={form.visionText}
            />
            <TextAreaField
              label="Benefits section"
              onChange={(value) => updateFormField("benefitsText", value)}
              placeholder="One benefit per line"
              value={form.benefitsText}
            />
            <TextAreaField
              label="FAQ"
              onChange={(value) => updateFormField("faqText", value)}
              placeholder={"Question\nAnswer\n\nQuestion\nAnswer"}
              value={form.faqText}
            />
            <TextAreaField
              label="Trust/support text"
              onChange={(value) => updateFormField("trustText", value)}
              value={form.trustText}
            />
            <TextAreaField
              label="Social media copy"
              onChange={(value) => updateFormField("socialCopy", value)}
              value={form.socialCopy}
            />
          </div>

          {form.slug ? (
            <p className={styles.linkWarning}>
              Stable public link: <code>{getCoachPublicUrl(form.slug)}</code>. Changing slug will
              change the public link.
            </p>
          ) : null}

          <div className={styles.formActions}>
            <button
              className={styles.secondaryAction}
              disabled={aiSubmitting}
              onClick={() => void handleGenerateWithAi()}
              type="button"
            >
              {aiSubmitting ? "Generating..." : "Generate with AI"}
            </button>
            <button className={styles.primaryAction} type="submit">
              Generate Site
            </button>
            <button
              className={styles.secondaryAction}
              disabled={!previewSite}
              onClick={() => saveSite("draft")}
              type="button"
            >
              Save Draft
            </button>
            <button
              className={styles.primaryAction}
              disabled={!previewSite}
              onClick={() => saveSite("published")}
              type="button"
            >
              Publish Site
            </button>
          </div>
        </form>

        {creationMessage ? <p className={styles.inlineStatus}>{creationMessage}</p> : null}
        {aiMessage ? <p className={styles.inlineStatus}>{aiMessage}</p> : null}
        {message ? <p className={styles.inlineStatus}>{message}</p> : null}
      </section>

      {previewSite ? <CoachSitePreview site={previewSite} /> : null}

      {removeCandidate ? (
        <section className={styles.removePanel} aria-labelledby="remove-coach-site-title">
          <div>
            <p className={styles.kicker}>Remove Coach Site</p>
            <h2 id="remove-coach-site-title">OTP protected archive required</h2>
            <p>
              This action may permanently remove this coach website. Soft-delete/archive is
              preferred. OTP verification is not configured, so permanent removal is disabled.
            </p>
          </div>
          <dl className={styles.removeDetails}>
            <div>
              <dt>Coach</dt>
              <dd>{removeCandidate.coachName}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{removeCandidate.slug}</dd>
            </div>
            <div>
              <dt>Public link</dt>
              <dd>{removeCandidate.publicUrl}</dd>
            </div>
            <div>
              <dt>Visits</dt>
              <dd>{removeCandidate.analytics.totalVisits.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Clicks</dt>
              <dd>{removeCandidate.analytics.totalRegisterClicks.toLocaleString()}</dd>
            </div>
          </dl>
          <div className={styles.formGrid}>
            <label className={styles.compactField}>
              <span>Type coach slug or coach name</span>
              <input
                onChange={(event) => setRemoveConfirm(event.target.value)}
                value={removeConfirm}
              />
            </label>
            <label className={styles.compactField}>
              <span>Removal reason</span>
              <select onChange={(event) => setRemoveReason(event.target.value)} value={removeReason}>
                {removalReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={styles.linkWarning}>
            OTP verification not configured. Permanent removal is disabled.
          </p>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryAction}
              onClick={() => {
                setRemoveCandidate(null);
                setRemoveConfirm("");
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.dangerAction}
              disabled={
                removeConfirm !== removeCandidate.slug && removeConfirm !== removeCandidate.coachName
              }
              type="button"
            >
              Verify OTP & Archive
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

function CoachSitePreview({ site }: { site: CoachSiteRecord }) {
  const canRegister = Boolean(site.googleFormUrl);

  return (
    <section className={styles.section} aria-labelledby="coach-site-preview-title">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>Preview Before Publish</p>
          <h2 id="coach-site-preview-title">Fixed public coach template</h2>
        </div>
        <span className={styles.statusBadge} data-status={site.status}>
          {site.status}
        </span>
      </div>

      <article className={styles.coachPreview}>
        <div className={styles.previewHero}>
          <div>
            <p className={styles.previewNiche}>{site.niche}</p>
            <h3>{site.content.heroHeadline}</h3>
            <p>{site.content.subheadline}</p>
            <div className={styles.previewActions}>
              {canRegister ? (
                <a href={site.googleFormUrl} rel="noreferrer" target="_blank">
                  {site.registerButtonText || site.content.ctaText}
                </a>
              ) : (
                <button disabled type="button">
                  {site.registerButtonText || "Register Now"}
                </button>
              )}
              <code>{site.publicUrl}</code>
            </div>
            {!canRegister ? (
              <p className={styles.linkWarning}>
                Google Form link missing. Public users should see Contact Support fallback instead
                of a broken register link.
              </p>
            ) : null}
          </div>
          <div className={styles.previewMedia}>
            {site.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${site.coachName} profile`} src={site.photoUrl} />
            ) : (
              <span>{site.coachName.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
        </div>

        <div className={styles.previewGrid}>
          <section>
            <h4>Coach introduction</h4>
            <p>{site.content.coachIntro}</p>
          </section>
          <section>
            <h4>Vision</h4>
            <p>{site.content.visionText}</p>
          </section>
          <section>
            <h4>Benefits</h4>
            <ul>
              {site.content.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4>FAQ</h4>
            {site.content.faq.map((item) => (
              <div key={item.question}>
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
              </div>
            ))}
          </section>
          <section>
            <h4>Contact Support</h4>
            <strong>{site.coachName}</strong>
            <p>{site.supportText || "Need help? Contact your coach directly."}</p>
            <p>
              {site.coachPhone || site.whatsappLink || site.coachEmail
                ? [site.coachPhone, site.whatsappLink, site.coachEmail].filter(Boolean).join(" / ")
                : "Default Yours Wellness support will be shown until coach contact details are added."}
            </p>
          </section>
        </div>

        <p className={styles.inlineNote}>{site.content.trustText}</p>
      </article>
    </section>
  );
}

function TextField({
  label,
  onChange,
  required = false,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "email" | "text" | "url";
  value: string;
}) {
  return (
    <label className={styles.compactField}>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className={styles.compactField}>
      <span>{label}</span>
      <textarea
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
