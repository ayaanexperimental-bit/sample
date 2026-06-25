(function () {
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const root = document.documentElement;
  const progressBar = document.querySelector(".yw-scroll-progress__bar");
  const stickyRegisterCta = document.querySelector("[data-yw-sticky-register]");
  const stickyRegisterTrigger = document.querySelector(".circle-marquee");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function normalizedText(value, fallback) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    return normalized || fallback;
  }

  function appendMarqueeText(parent, className, text) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    parent.appendChild(span);
  }

  function appendMarqueeStar(parent) {
    const star = document.createElement("span");
    star.className = "circle-marquee__star";
    star.setAttribute("aria-hidden", "true");
    star.textContent = " \u2605 ";
    parent.appendChild(star);
  }

  function buildMarqueeItem(brand, coachName) {
    const item = document.createElement("span");
    item.className = "circle-marquee__item";

    appendMarqueeText(item, "circle-marquee__brand", brand);
    appendMarqueeStar(item);
    appendMarqueeText(item, "circle-marquee__name", coachName);
    appendMarqueeStar(item);

    return item;
  }

  function initCircleMarquees() {
    document.querySelectorAll("[data-yw-circle-marquee]").forEach((marquee) => {
      const track = marquee.querySelector(".circle-marquee__track");

      if (!track) {
        return;
      }

      const fallbackName = track.querySelector(".circle-marquee__name")?.textContent || "RAJ SHAMANI";
      const brand = normalizedText(marquee.dataset.ywMarqueeBrand, "YW NUTRITECH CIRCLE").toUpperCase();
      const coachName = normalizedText(marquee.dataset.ywMarqueeName, fallbackName).toUpperCase();
      const requestedRepeats = Number.parseInt(marquee.dataset.ywMarqueeRepeats || "20", 10);
      const repeatCount = Number.isFinite(requestedRepeats)
        ? Math.max(8, Math.min(32, requestedRepeats))
        : 20;

      track.textContent = "";

      for (let index = 0; index < repeatCount; index += 1) {
        track.appendChild(buildMarqueeItem(brand, coachName));
      }

      marquee.setAttribute("aria-label", `${brand} ${coachName} marquee`);
    });
  }

  function getIndiaDateParts(date) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(date).reduce((values, part) => {
      if (part.type !== "literal") {
        values[part.type] = Number(part.value);
      }
      return values;
    }, {});

    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
    };
  }

  function ordinalDay(day) {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) {
      return `${day}th`;
    }

    switch (day % 10) {
      case 1:
        return `${day}st`;
      case 2:
        return `${day}nd`;
      case 3:
        return `${day}rd`;
      default:
        return `${day}th`;
    }
  }

  function getNextTuesdayDate(now = new Date()) {
    const indiaNow = getIndiaDateParts(now);
    const indiaDay = new Date(Date.UTC(indiaNow.year, indiaNow.month - 1, indiaNow.day)).getUTCDay();
    let daysUntilTuesday = (2 - indiaDay + 7) % 7;

    if (daysUntilTuesday === 0 && indiaNow.hour >= 21) {
      daysUntilTuesday = 7;
    }

    return new Date(Date.UTC(indiaNow.year, indiaNow.month - 1, indiaNow.day + daysUntilTuesday));
  }

  function formatProgramDate(date) {
    const day = date.getUTCDate();
    const month = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      timeZone: "UTC",
    }).format(date);

    return `${ordinalDay(day)} ${month} ${date.getUTCFullYear()}`;
  }

  function initDynamicProgramDate() {
    const dateTargets = document.querySelectorAll("[data-yw-program-date]");

    if (!dateTargets.length) {
      return;
    }

    const programDate = getNextTuesdayDate();
    const label = formatProgramDate(programDate);
    const machineDate = programDate.toISOString().slice(0, 10);

    dateTargets.forEach((target) => {
      target.textContent = label;
      target.setAttribute("data-yw-program-date-value", machineDate);
      if (target.tagName === "TIME") {
        target.setAttribute("datetime", machineDate);
      }
    });

    window.ywProgramDate = {
      label,
      date: machineDate,
      rule: "Weekly Tuesday, rolls to next Tuesday after 9:00 PM IST",
    };
  }

  function getScrollY() {
    return window.scrollY || root.scrollTop || document.body.scrollTop || 0;
  }

  function updateStickyRegister(currentScroll) {
    if (!stickyRegisterCta || !stickyRegisterTrigger) {
      return;
    }

    const triggerRect = stickyRegisterTrigger.getBoundingClientRect();
    const scrollTop = typeof currentScroll === "number" ? currentScroll : getScrollY();
    const activationPoint = Math.max(120, window.innerHeight - 56);
    const triggerReached = triggerRect.top <= activationPoint;
    const shouldShow = scrollTop > 56 && triggerReached;

    root.classList.toggle("yw-sticky-register-visible", shouldShow);
    stickyRegisterCta.classList.toggle("is-visible", shouldShow);
    stickyRegisterCta.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    stickyRegisterCta.tabIndex = shouldShow ? 0 : -1;
  }

  function updateAlliaSectionVars() {
    const hero = document.querySelector(".yw-circle-hero");
    const footer = document.querySelector(".yw-brand-footer");

    if (hero) {
      const rect = hero.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight * 0.2);
      const progress = clamp(-rect.top / travel);
      root.style.setProperty("--yw-hero-progress", progress.toFixed(4));
    }

    if (footer) {
      const rect = footer.getBoundingClientRect();
      const progress = clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height));
      root.style.setProperty("--yw-footer-progress", progress.toFixed(4));
    }
  }

  function updateProgress(currentScroll) {
    const maxScroll = root.scrollHeight - window.innerHeight;
    const scrollTop = typeof currentScroll === "number" ? currentScroll : getScrollY();
    const progress = maxScroll > 0 ? clamp(scrollTop / maxScroll) : 0;

    root.style.setProperty("--yw-scroll-progress", progress.toFixed(4));
    root.style.setProperty("--yw-scroll-y", `${scrollTop.toFixed(1)}px`);
    root.classList.toggle("yw-nav-condensed", scrollTop > 36);

    if (progressBar) {
      progressBar.style.transform = `scaleX(${progress})`;
    }

    updateStickyRegister(scrollTop);
    updateAlliaSectionVars();
  }

  function initAlliaGradientBackground() {
    const gradientLayer = document.getElementById("background");

    if (!gradientLayer) {
      return null;
    }

    const keyframes = [
      { gradX: 50, gradY: 50, sizeX: 50, sizeY: 50, color1: "#F4F8FA", color2: "#D0F5F0", color3: "#E8F5D6", stop1: 26.92, stop2: 54.33 },
      { gradX: 50, gradY: 0, sizeX: 100, sizeY: 100, color1: "#CDEF63", color2: "#21E6C1", color3: "#D0F5F0", stop1: 23.08, stop2: 65.87 },
      { gradX: 0, gradY: 50, sizeX: 50, sizeY: 98.87, color1: "#F4F8FA", color2: "#D0F5F0", color3: "#D0F5F0", stop1: 14.9, stop2: 51.92 },
      { gradX: 50, gradY: 50, sizeX: 100, sizeY: 100, color1: "#F4F8FA", color2: "#F4F8FA", color3: "#F4F8FA", stop1: 0, stop2: 0 },
      { gradX: 50, gradY: 0, sizeX: 80.34, sizeY: 80.34, color1: "#FFE8D1", color2: "#F4F8FA", color3: "#F4F8FA", stop1: 0, stop2: 100 },
      { gradX: 100, gradY: 50, sizeX: 100, sizeY: 261.49, color1: "#D0F5F0", color2: "#D0F5F0", color3: "#E8F5D6", stop1: 0, stop2: 0 },
    ];
    const sectionToKeyframeMap = [0, 1, 5, 2, 3, 4];
    const sectionSelector = [
      ".yw-circle-hero",
      ".yw-story-section",
      ".yw-sales-section",
      ".yw-circle-faq",
      ".yw-brand-footer",
    ].join(",");
    let sectionDataArray = [];
    let ticking = false;

    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

      if (!result) {
        return { r: 244, g: 248, b: 250 };
      }

      return {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      };
    }

    function interpolateColor(color1, color2, t) {
      const rgb1 = hexToRgb(color1);
      const rgb2 = hexToRgb(color2);
      const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
      const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
      const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);

      return `rgb(${r}, ${g}, ${b})`;
    }

    function interpolateKeyframes(kf1, kf2, t) {
      return {
        gradX: kf1.gradX + (kf2.gradX - kf1.gradX) * t,
        gradY: kf1.gradY + (kf2.gradY - kf1.gradY) * t,
        sizeX: kf1.sizeX + (kf2.sizeX - kf1.sizeX) * t,
        sizeY: kf1.sizeY + (kf2.sizeY - kf1.sizeY) * t,
        color1: interpolateColor(kf1.color1, kf2.color1, t),
        color2: interpolateColor(kf1.color2, kf2.color2, t),
        color3: interpolateColor(kf1.color3, kf2.color3, t),
        stop1: kf1.stop1 + (kf2.stop1 - kf1.stop1) * t,
        stop2: kf1.stop2 + (kf2.stop2 - kf1.stop2) * t,
      };
    }

    function getKeyframeValues(progress) {
      const keyframeProgress = clamp(progress) * (keyframes.length - 1);
      const lowerIndex = Math.floor(keyframeProgress);
      const upperIndex = Math.min(lowerIndex + 1, keyframes.length - 1);
      const localProgress = keyframeProgress - lowerIndex;

      return interpolateKeyframes(keyframes[lowerIndex], keyframes[upperIndex], localProgress);
    }

    function getKeyframeProgress(sectionIndex) {
      const mappedIndex = sectionToKeyframeMap[sectionIndex % sectionToKeyframeMap.length];

      return mappedIndex / (keyframes.length - 1);
    }

    function initializeSections() {
      const scrollTop = getScrollY();

      sectionDataArray = Array.from(document.querySelectorAll(sectionSelector))
        .map((section, index) => {
          const rect = section.getBoundingClientRect();
          const top = rect.top + scrollTop;

          return {
            element: section,
            index,
            top,
            bottom: top + rect.height,
            height: rect.height,
          };
        })
        .filter((section) => section.height > 0);
    }

    function setGradientValues(values) {
      gradientLayer.style.setProperty("--grad-x", `${values.gradX}%`);
      gradientLayer.style.setProperty("--grad-y", `${values.gradY}%`);
      gradientLayer.style.setProperty("--grad-size-x", `${values.sizeX}%`);
      gradientLayer.style.setProperty("--grad-size-y", `${values.sizeY}%`);
      gradientLayer.style.setProperty("--color-1", values.color1);
      gradientLayer.style.setProperty("--color-2", values.color2);
      gradientLayer.style.setProperty("--color-3", values.color3);
      gradientLayer.style.setProperty("--stop-1", `${values.stop1}%`);
      gradientLayer.style.setProperty("--stop-2", `${values.stop2}%`);
    }

    function updateGradientFromScroll() {
      if (!sectionDataArray.length) {
        initializeSections();
      }

      if (!sectionDataArray.length) {
        return;
      }

      const viewportCenter = getScrollY() + window.innerHeight / 2;
      let currentSectionIndex = 0;
      let interpolationFactor = 0;

      for (let index = 0; index < sectionDataArray.length; index += 1) {
        const section = sectionDataArray[index];

        if (viewportCenter < section.top) {
          currentSectionIndex = Math.max(0, index - 1);
          break;
        }

        if (viewportCenter >= section.top && viewportCenter <= section.bottom) {
          currentSectionIndex = index;
          const sectionCenter = section.top + section.height / 2;
          const distanceFromCenter = viewportCenter - sectionCenter;

          if (index < sectionDataArray.length - 1 && distanceFromCenter > 0) {
            const nextSection = sectionDataArray[index + 1];
            const gap = Math.max(0, nextSection.top - section.bottom);
            const transitionZone = Math.max(1, Math.min(section.height * 0.3, gap > 0 ? gap / 2 : section.height * 0.24));
            const transitionStart = section.bottom - transitionZone;

            if (viewportCenter >= transitionStart) {
              interpolationFactor = clamp((viewportCenter - transitionStart) / (transitionZone + gap + Math.min(nextSection.height * 0.18, window.innerHeight * 0.32)));
            }
          }

          break;
        }

        currentSectionIndex = index;
      }

      let targetKeyframeProgress = getKeyframeProgress(currentSectionIndex);

      if (interpolationFactor > 0 && currentSectionIndex < sectionDataArray.length - 1) {
        const nextKeyframeProgress = getKeyframeProgress(currentSectionIndex + 1);
        targetKeyframeProgress += (nextKeyframeProgress - targetKeyframeProgress) * interpolationFactor;
      }

      setGradientValues(getKeyframeValues(targetKeyframeProgress));
    }

    function scheduleUpdate() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        updateGradientFromScroll();
        ticking = false;
      });
    }

    function refresh() {
      initializeSections();
      updateGradientFromScroll();
    }

    refresh();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", refresh);
    window.addEventListener("load", refresh);
    window.ywAlliaGradientBackground = { refresh };

    return window.ywAlliaGradientBackground;
  }

  function initSmoothScroll() {
    if (!window.Lenis || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.ywLenisActive = false;
      return null;
    }

    const lenis = new window.Lenis({
      lerp: 0.1,
      wheelMultiplier: 0.7,
      gestureOrientation: "vertical",
      normalizeWheel: false,
      smoothTouch: false,
    });

    function raf(time) {
      lenis.raf(time);
      updateAlliaSectionVars();
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    lenis.on("scroll", (event) => {
      updateProgress(event && typeof event.scroll === "number" ? event.scroll : undefined);
    });

    document.querySelectorAll("[data-lenis-start]").forEach((element) => {
      element.addEventListener("click", () => lenis.start());
    });

    document.querySelectorAll("[data-lenis-stop]").forEach((element) => {
      element.addEventListener("click", () => lenis.stop());
    });

    document.querySelectorAll("[data-lenis-toggle]").forEach((element) => {
      element.addEventListener("click", () => {
        element.classList.toggle("stop-scroll");
        if (element.classList.contains("stop-scroll")) {
          lenis.stop();
        } else {
          lenis.start();
        }
      });
    });

    window.ywLenis = lenis;
    window.ywLenisActive = true;
    return lenis;
  }

  function initReveals() {
    const revealTargets = document.querySelectorAll([
      ".circle-marquee",
      ".yw-circle-hero > .elementor-section",
      ".yw-story-section",
      ".yw-story-media",
      ".yw-story-copy",
      ".yw-sales-section",
      ".yw-check-grid",
      ".yw-blueprint-grid",
      ".yw-result-cards",
      ".yw-fit-table",
      ".yw-bonus-grid",
      ".yw-circle-faq",
      ".yw-brand-footer",
      ".yw-footer-about",
      ".yw-footer-stats",
      ".yw-footer-brand",
    ].join(","));

    revealTargets.forEach((target) => target.classList.add("yw-reveal"));

    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealTargets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {
      root: null,
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    });

    revealTargets.forEach((target) => observer.observe(target));
  }

  function initAlliaWebflowEffects() {
    const effectGroups = [
      ".yw-circle-hero .elementor-element-175afb4",
      ".yw-circle-hero .elementor-element-a2d0984",
      ".yw-circle-hero .elementor-element-1a369ef",
      ".yw-circle-hero .elementor-element-7217277",
      ".yw-circle-hero .elementor-element-afb23e5",
      ".yw-circle-hero .elementor-element-b1105bd",
      ".yw-circle-hero .elementor-element-e2303b9",
      ".yw-circle-hero .elementor-element-6a32f27",
      ".yw-circle-hero .elementor-element-98a2fea",
      ".yw-circle-hero .elementor-element-4a1595b",
      ".yw-circle-hero .elementor-element-de286ff",
      ".yw-circle-hero .elementor-element-d59d08f",
      ".yw-circle-hero .elementor-element-fc8b7b1",
      ".circle-marquee",
      ".yw-story-media",
      ".yw-story-copy",
      ".yw-story-stats > div",
      ".yw-sales-section .yw-kicker",
      ".yw-sales-section h2",
      ".yw-sales-section .yw-section-subcopy",
      ".yw-check-row",
      ".yw-blueprint-grid article",
      ".yw-result-cards article",
      ".yw-fit-col",
      ".yw-bonus-grid article",
      ".yw-register-strip",
      ".yw-circle-faq .elementor-widget-heading",
      ".yw-circle-faq .elementor-accordion-item",
      ".yw-legal-card",
      ".yw-footer-about",
      ".yw-footer-stat",
      ".yw-footer-legal",
      ".yw-footer-legal-links a",
      ".yw-footer-brand",
    ];
    const effectTargets = Array.from(document.querySelectorAll(effectGroups.join(",")));
    const floatTargets = [
      ".yw-circle-hero .elementor-element-afb23e5 .elementor-widget-container",
      ".yw-story-video-card",
      ".yw-footer-brand",
    ];
    let scrollTicking = false;
    let pointerTicking = false;
    let pointerX = 0;
    let pointerY = 0;

    effectTargets.forEach((target, index) => {
      target.classList.add("yw-allia-effect");
      target.style.setProperty("--yw-reveal-delay", `${Math.min(520, index * 36)}ms`);
    });

    floatTargets.forEach((selector) => {
      document.querySelectorAll(selector).forEach((target) => {
        target.classList.add("yw-allia-float");
      });
    });

    if (!("IntersectionObserver" in window) || reducedMotion.matches) {
      effectTargets.forEach((target) => {
        target.classList.add("is-visible", "is-allia-visible");
      });
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible", "is-allia-visible");
          observer.unobserve(entry.target);
        });
      }, {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.08,
      });

      effectTargets.forEach((target) => observer.observe(target));
    }

    function updateSectionProgress() {
      updateAlliaSectionVars();
    }

    function scheduleScrollUpdate() {
      if (scrollTicking) {
        return;
      }

      scrollTicking = true;
      window.requestAnimationFrame(() => {
        updateSectionProgress();
        scrollTicking = false;
      });
    }

    function commitPointer() {
      root.style.setProperty("--yw-pointer-x", pointerX.toFixed(4));
      root.style.setProperty("--yw-pointer-y", pointerY.toFixed(4));
      pointerTicking = false;
    }

    function updatePointer(event) {
      if (reducedMotion.matches) {
        return;
      }

      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;

      if (!pointerTicking) {
        pointerTicking = true;
        window.requestAnimationFrame(commitPointer);
      }
    }

    function resetPointer() {
      pointerX = 0;
      pointerY = 0;

      if (!pointerTicking) {
        pointerTicking = true;
        window.requestAnimationFrame(commitPointer);
      }
    }

    updateSectionProgress();
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate);
    window.addEventListener("load", scheduleScrollUpdate);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerleave", resetPointer, { passive: true });

    window.ywAlliaWebflowEffects = {
      refresh: () => {
        updateSectionProgress();
        updateProgress();
      },
      targetCount: effectTargets.length,
    };
  }

  function initSectionSyncedNavbar() {
    if (window.ywSectionSyncedNavbarReady) {
      return;
    }

    window.ywSectionSyncedNavbarReady = true;

    const navbar = document.querySelector(".navbar14_component");
    const rawLinks = Array.from(document.querySelectorAll("[data-yw-nav-link]"));
    const links = rawLinks
      .map((link) => {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#") || href.length < 2) {
          return null;
        }

        const id = decodeURIComponent(href.slice(1));
        const target = document.getElementById(id);

        if (!target) {
          link.setAttribute("hidden", "hidden");
          link.setAttribute("aria-hidden", "true");
          link.tabIndex = -1;
          return null;
        }

        return { id, link, target };
      })
      .filter(Boolean);

    if (!links.length) {
      return;
    }

    let activeId = "";
    let activeFrame = 0;

    function getMenu() {
      return document.querySelector("[data-yw-nav-menu]");
    }

    function getToggle() {
      return document.querySelector("[data-yw-nav-toggle]");
    }

    function getNavOffset() {
      if (!navbar) {
        return 96;
      }

      const rect = navbar.getBoundingClientRect();
      return Math.max(82, rect.top + rect.height + 18);
    }

    function syncMenuPlacement() {
      const menu = getMenu();
      if (!navbar || !menu) {
        return;
      }

      const container = navbar.querySelector(".navbar14_container") || navbar;
      const navRect = navbar.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const localBlock = menu.closest(".navbar14_container") ? containerRect : { left: 0, top: 0 };
      const viewportWidth = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 0);
      const desiredLeft = Math.max(12, Math.min(containerRect.left, viewportWidth - 24));
      const width = Math.max(240, Math.min(containerRect.width, viewportWidth - desiredLeft - 12));
      const desiredTop = Math.max(72, Math.min(navRect.bottom + 12, window.innerHeight - 96));
      const left = Math.max(0, desiredLeft - localBlock.left);
      const top = Math.max(0, desiredTop - localBlock.top);

      root.style.setProperty("--yw-nav-menu-top", `${top.toFixed(1)}px`);
      root.style.setProperty("--yw-nav-menu-left", `${left.toFixed(1)}px`);
      root.style.setProperty("--yw-nav-menu-width", `${width.toFixed(1)}px`);
    }

    function setMenuOpen(isOpen) {
      const menu = getMenu();
      const toggle = getToggle();
      if (!menu || !toggle) {
        return;
      }

      menu.classList.toggle("is-open", isOpen);
      menu.classList.toggle("w--open", isOpen);
      toggle.classList.toggle("w--open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.setAttribute("aria-label", isOpen ? "Close coach site menu" : "Open coach site menu");
      root.classList.toggle("yw-nav-menu-open", isOpen);

      if (isOpen) {
        window.requestAnimationFrame(syncMenuPlacement);
      }
    }

    function closeMenu() {
      setMenuOpen(false);
    }

    function setActive(nextId) {
      if (!nextId || nextId === activeId) {
        return;
      }

      activeId = nextId;
      Array.from(document.querySelectorAll("[data-yw-nav-link]")).forEach((link) => {
        const href = link.getAttribute("href") || "";
        const id = href.startsWith("#") ? decodeURIComponent(href.slice(1)) : "";
        const isActive = id === nextId;
        if (link.classList.contains("navbar14_logo-link")) {
          link.classList.remove("is-active");
          link.removeAttribute("aria-current");
          return;
        }
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function updateActive() {
      const offset = getNavOffset() + 6;
      let next = links[0];

      links.forEach((item) => {
        const rect = item.target.getBoundingClientRect();
        if (rect.top - offset <= 0) {
          next = item;
        }
      });

      setActive(next.id);
      activeFrame = 0;
    }

    function scheduleActiveUpdate() {
      if (activeFrame) {
        return;
      }

      activeFrame = window.requestAnimationFrame(() => {
        if (root.classList.contains("yw-nav-menu-open")) {
          syncMenuPlacement();
        }
        updateActive();
      });
    }

    function scrollToTarget(target) {
      const offset = -getNavOffset();

      const top = target.getBoundingClientRect().top + getScrollY() + offset;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    }

    function handleCapturedNavClick(event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const clickedLink = target.closest("[data-yw-nav-link]");
      if (!clickedLink) {
        return;
      }

      const href = clickedLink.getAttribute("href") || "";
      const id = href.startsWith("#") ? decodeURIComponent(href.slice(1)) : "";
      const item = links.find((navItem) => navItem.id === id);
      if (!item) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      setActive(item.id);
      scrollToTarget(item.target);
      window.setTimeout(scheduleActiveUpdate, reducedMotion.matches ? 40 : 220);
    }

    function handleCapturedToggleClick(event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const clickedToggle = target.closest("[data-yw-nav-toggle]");
      if (!clickedToggle) {
        return;
      }

      const menu = getMenu();
      if (!menu) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(!menu.classList.contains("is-open"));
    }

    if (getToggle() && getMenu()) {
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeMenu();
        }
      });

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!root.classList.contains("yw-nav-menu-open")) {
          return;
        }

        if (navbar && target instanceof Node && navbar.contains(target)) {
          return;
        }

        closeMenu();
      });
    }

    document.addEventListener("click", handleCapturedToggleClick, true);
    document.addEventListener("click", handleCapturedNavClick, true);
    window.addEventListener("scroll", scheduleActiveUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveUpdate);
    window.addEventListener("load", scheduleActiveUpdate);
    updateActive();
  }

  function initHashScroll(lenis) {
    if (!window.location.hash || window.location.hash.length < 2) {
      return;
    }

    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = document.getElementById(id);

    if (!target) {
      return;
    }

    window.setTimeout(() => {
      if (lenis && window.ywLenisActive) {
        lenis.scrollTo(target, { immediate: true, offset: -120 });
      } else {
        const top = target.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      }

      updateProgress();
    }, 450);
  }

  function init() {
    window.ywRefreshCircleMarquees = initCircleMarquees;
    initCircleMarquees();
    initDynamicProgramDate();
    initAlliaGradientBackground();
    const lenis = initSmoothScroll();
    initReveals();
    initAlliaWebflowEffects();
    initSectionSyncedNavbar();
    initHashScroll(lenis);
    updateProgress();

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    window.addEventListener("load", updateProgress);
    window.addEventListener("focus", initDynamicProgramDate);
    window.setInterval(initDynamicProgramDate, 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
