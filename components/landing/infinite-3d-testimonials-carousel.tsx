"use client";

/* eslint-disable @next/next/no-img-element */
import type { FocusEvent, KeyboardEvent, PointerEvent, TouchEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/landing/use-reduced-motion";

export type TestimonialCarouselItem = {
  src: string;
  alt: string;
};

type Infinite3DTestimonialsCarouselProps = {
  testimonials: TestimonialCarouselItem[];
};

const ITEM_TRAVEL_MS = 5600;
const CENTERING_DURATION_MS = 560;
const RESUME_DELAY_MS = 650;
const TOUCH_READ_DELAY_MS = 2600;
const SWIPE_THRESHOLD_PX = 38;
const CENTERED_POSITION_EPSILON = 0.035;

type CarouselDirection = 1 | -1;

type DragState = {
  active: boolean;
  moved: boolean;
  pointerId: number | null;
  pointerType: string;
  startProgress: number;
  startX: number;
  startY: number;
};

type CenteringState = {
  active: boolean;
  selectedIndex: number | null;
  startProgress: number;
  startTime: number;
  targetProgress: number;
};

type CarouselMetrics = {
  cardWidth: number;
  farOpacity: number;
  farScale: number;
  maxRotate: number;
  sideOpacity: number;
  sideScale: number;
  spacing: number;
  yDepth: number;
  zDepth: number;
};

function wrapProgress(progress: number, length: number) {
  return ((progress % length) + length) % length;
}

function getLoopPosition(index: number, progress: number, length: number) {
  const half = length / 2;
  return wrapProgress(index - progress + half, length) - half;
}

function getNearestCenteredProgress(currentProgress: number, index: number, length: number) {
  const current = wrapProgress(currentProgress, length);
  let delta = index - current;

  if (delta > length / 2) {
    delta -= length;
  }

  if (delta < -length / 2) {
    delta += length;
  }

  return currentProgress + delta;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function interpolateDepth(value: number, center: number, side: number, far: number) {
  const absolute = Math.min(Math.abs(value), 1.5);

  if (absolute <= 1) {
    return center + (side - center) * absolute;
  }

  return side + (far - side) * ((absolute - 1) / 0.5);
}

function getCarouselMetrics(stageWidth: number): CarouselMetrics {
  if (stageWidth < 430) {
    return {
      cardWidth: Math.min(stageWidth - 52, 306),
      farOpacity: 0,
      farScale: 0.58,
      maxRotate: 13,
      sideOpacity: 0.34,
      sideScale: 0.7,
      spacing: Math.min(Math.max(stageWidth * 0.72, 210), 280),
      yDepth: 15,
      zDepth: 76
    };
  }

  if (stageWidth < 820) {
    return {
      cardWidth: Math.min(stageWidth * 0.58, 385),
      farOpacity: 0,
      farScale: 0.62,
      maxRotate: 18,
      sideOpacity: 0.56,
      sideScale: 0.78,
      spacing: Math.min(stageWidth * 0.46, 330),
      yDepth: 24,
      zDepth: 110
    };
  }

  return {
    cardWidth: Math.min(stageWidth * 0.36, 405),
    farOpacity: 0,
    farScale: 0.68,
    maxRotate: 22,
    sideOpacity: 0.66,
    sideScale: 0.82,
    spacing: Math.min(stageWidth * 0.39, 430),
    yDepth: 28,
    zDepth: 130
  };
}

export function Infinite3DTestimonialsCarousel({
  testimonials
}: Infinite3DTestimonialsCarouselProps) {
  const reducedMotion = useReducedMotion();
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isCentering, setIsCentering] = useState(false);
  const [touchedIndex, setTouchedIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<CarouselDirection>(1);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const progressRef = useRef(0);
  const directionRef = useRef<CarouselDirection>(1);
  const pausedRef = useRef(false);
  const interactionModeRef = useRef<"keyboard" | "mouse" | "touch" | null>(null);
  const lastTouchInteractionRef = useRef(Number.NEGATIVE_INFINITY);
  const centeringRef = useRef<CenteringState>({
    active: false,
    selectedIndex: null,
    startProgress: 0,
    startTime: 0,
    targetProgress: 0
  });
  const resumeTimerRef = useRef<number | null>(null);
  const touchAutoResumeTimerRef = useRef<number | null>(null);
  const dragRef = useRef<DragState>({
    active: false,
    moved: false,
    pointerId: null,
    pointerType: "",
    startProgress: 0,
    startX: 0,
    startY: 0
  });
  const testimonialCount = testimonials.length;

  const markTouchInteraction = useCallback(() => {
    lastTouchInteractionRef.current = performance.now();
  }, []);

  const isRecentTouchInteraction = useCallback(
    () =>
      performance.now() - lastTouchInteractionRef.current <
      TOUCH_READ_DELAY_MS + RESUME_DELAY_MS + 500,
    []
  );

  const clearTouchAutoResumeTimer = useCallback(() => {
    if (touchAutoResumeTimerRef.current !== null) {
      window.clearTimeout(touchAutoResumeTimerRef.current);
      touchAutoResumeTimerRef.current = null;
    }
  }, []);

  const resetDragState = useCallback(
    (startProgress = progressRef.current) => {
      clearTouchAutoResumeTimer();
      dragRef.current = {
        active: false,
        moved: false,
        pointerId: null,
        pointerType: "",
        startProgress,
        startX: 0,
        startY: 0
      };
    },
    [clearTouchAutoResumeTimer]
  );

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const applyCardStyles = useCallback(() => {
    const stage = stageRef.current;

    if (!stage || testimonialCount < 2) {
      return;
    }

    const metrics = getCarouselMetrics(stage.clientWidth);
    const progress = wrapProgress(progressRef.current, testimonialCount);

    stage.style.setProperty("--carousel-card-width", `${metrics.cardWidth}px`);

    cardRefs.current.slice(0, testimonialCount).forEach((card, index) => {
      if (!card) return;

      const position = getLoopPosition(index, progress, testimonialCount);
      const absolute = Math.min(Math.abs(position), 1.5);
      const scale = interpolateDepth(position, 1, metrics.sideScale, metrics.farScale);
      const opacity = interpolateDepth(position, 1, metrics.sideOpacity, metrics.farOpacity);
      const y = interpolateDepth(position, 0, metrics.yDepth, metrics.yDepth * 2);
      const z = interpolateDepth(position, 86, 0, -metrics.zDepth);
      const rotateY = Math.max(-28, Math.min(28, -position * metrics.maxRotate));
      const x = position * metrics.spacing;
      const blur = stage.clientWidth < 520 ? 0 : Math.max(0, absolute - 1) * 0.55;
      const saturation = 1 - Math.min(absolute, 1.5) * 0.12;

      card.style.setProperty("width", `${metrics.cardWidth}px`, "important");
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(Math.round(60 - absolute * 22));
      card.style.filter =
        blur > 0
          ? `saturate(${saturation.toFixed(2)}) blur(${blur.toFixed(2)}px)`
          : `saturate(${saturation.toFixed(2)})`;
      card.style.setProperty(
        "transform",
        `translateX(-50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
        "important"
      );
    });
  }, [testimonialCount]);

  const clearCardStyles = useCallback(() => {
    stageRef.current?.style.removeProperty("--carousel-card-width");
    cardRefs.current.forEach((card) => {
      if (!card) return;

      card.style.removeProperty("filter");
      card.style.removeProperty("opacity");
      card.style.removeProperty("transform");
      card.style.removeProperty("width");
      card.style.removeProperty("z-index");
    });
  }, []);

  const pauseCarousel = useCallback(() => {
    clearResumeTimer();
    centeringRef.current.active = false;
    pausedRef.current = true;
    setIsCentering(false);
    setIsPaused(true);
  }, [clearResumeTimer]);

  const centerCardForReading = useCallback(
    (index: number) => {
      clearResumeTimer();
      clearTouchAutoResumeTimer();
      pausedRef.current = true;
      setIsPaused(true);

      if (testimonialCount < 2) {
        setIsCentering(false);
        return;
      }

      const currentProgress = progressRef.current;
      const currentPosition = getLoopPosition(index, currentProgress, testimonialCount);
      const targetProgress = getNearestCenteredProgress(
        currentProgress,
        index,
        testimonialCount
      );

      if (reducedMotion || Math.abs(currentPosition) <= CENTERED_POSITION_EPSILON) {
        centeringRef.current = {
          active: false,
          selectedIndex: index,
          startProgress: targetProgress,
          startTime: performance.now(),
          targetProgress
        };
        progressRef.current = wrapProgress(targetProgress, testimonialCount);
        setIsCentering(false);
        applyCardStyles();
        return;
      }

      centeringRef.current = {
        active: true,
        selectedIndex: index,
        startProgress: currentProgress,
        startTime: performance.now(),
        targetProgress
      };
      setIsCentering(true);
    },
    [
      applyCardStyles,
      clearResumeTimer,
      clearTouchAutoResumeTimer,
      reducedMotion,
      testimonialCount
    ]
  );

  const blurTouchFocus = useCallback(() => {
    const activeElement = document.activeElement;

    if (
      activeElement instanceof HTMLElement &&
      carouselRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
  }, []);

  const hasBlockingInteraction = useCallback(() => {
    const carousel = carouselRef.current;
    const mode = interactionModeRef.current;

    if (!carousel || mode === "touch" || isRecentTouchInteraction()) {
      return false;
    }

    if (mode === "keyboard") {
      return dragRef.current.active || carousel.contains(document.activeElement);
    }

    return dragRef.current.active || carousel.matches(":hover");
  }, [isRecentTouchInteraction]);

  const resumeCarousel = useCallback(
    (delay = RESUME_DELAY_MS) => {
      clearResumeTimer();

      resumeTimerRef.current = window.setTimeout(() => {
        if (hasBlockingInteraction()) {
          resumeTimerRef.current = null;
          return;
        }

        if (interactionModeRef.current === "touch" || isRecentTouchInteraction()) {
          blurTouchFocus();
        }

        centeringRef.current.active = false;
        interactionModeRef.current = null;
        pausedRef.current = false;
        setHoveredIndex(null);
        setIsCentering(false);
        setTouchedIndex(null);
        setIsPaused(false);
        resumeTimerRef.current = null;
      }, delay);
    },
    [blurTouchFocus, clearResumeTimer, hasBlockingInteraction, isRecentTouchInteraction]
  );

  const forceResumeFromTouch = useCallback(() => {
    clearResumeTimer();
    resetDragState();
    blurTouchFocus();
    centeringRef.current.active = false;
    interactionModeRef.current = null;
    pausedRef.current = false;
    setHoveredIndex(null);
    setIsCentering(false);
    setTouchedIndex(null);
    setIsPaused(false);
  }, [blurTouchFocus, clearResumeTimer, resetDragState]);

  const finishTouchInteraction = useCallback(
    (delay = TOUCH_READ_DELAY_MS) => {
      const drag = dragRef.current;

      if (!drag.active || drag.pointerType === "mouse") {
        return;
      }

      resetDragState();
      resumeCarousel(drag.moved ? RESUME_DELAY_MS : delay);
    },
    [resetDragState, resumeCarousel]
  );

  const releaseControlInteraction = useCallback(() => {
    clearResumeTimer();
    clearTouchAutoResumeTimer();
    centeringRef.current.active = false;
    dragRef.current = {
      active: false,
      moved: false,
      pointerId: null,
      pointerType: "",
      startProgress: progressRef.current,
      startX: 0,
      startY: 0
    };
    interactionModeRef.current = null;
    pausedRef.current = false;
    setHoveredIndex(null);
    setIsCentering(false);
    setTouchedIndex(null);
    setIsPaused(false);
  }, [clearResumeTimer, clearTouchAutoResumeTimer]);

  const setCarouselDirection = useCallback((nextDirection: CarouselDirection) => {
    directionRef.current = nextDirection;
    setDirection(nextDirection);
  }, []);

  useEffect(() => {
    if (reducedMotion || testimonialCount < 2) {
      clearCardStyles();
      return;
    }

    let animationFrame = 0;
    let lastTime = performance.now();
    const resizeObserver = new ResizeObserver(applyCardStyles);

    if (stageRef.current) {
      resizeObserver.observe(stageRef.current);
    }

    function tick(currentTime: number) {
      const delta = Math.min(currentTime - lastTime, 80);
      lastTime = currentTime;
      const centering = centeringRef.current;

      if (centering.active) {
        const elapsed = currentTime - centering.startTime;
        const progress = Math.min(1, elapsed / CENTERING_DURATION_MS);
        const easedProgress = easeOutCubic(progress);

        progressRef.current =
          centering.startProgress +
          (centering.targetProgress - centering.startProgress) * easedProgress;

        if (progress >= 1) {
          progressRef.current = wrapProgress(centering.targetProgress, testimonialCount);
          centeringRef.current = {
            ...centering,
            active: false,
            startProgress: progressRef.current,
            targetProgress: progressRef.current
          };
          pausedRef.current = true;
          setIsCentering(false);
          setIsPaused(true);
        }
      } else if (!pausedRef.current) {
        progressRef.current = wrapProgress(
          progressRef.current + (delta / ITEM_TRAVEL_MS) * directionRef.current,
          testimonialCount
        );
      }

      applyCardStyles();
      animationFrame = window.requestAnimationFrame(tick);
    }

    applyCardStyles();
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [applyCardStyles, clearCardStyles, reducedMotion, testimonialCount]);

  useEffect(() => {
    return () => {
      clearResumeTimer();
      clearTouchAutoResumeTimer();
      clearCardStyles();
    };
  }, [clearCardStyles, clearResumeTimer, clearTouchAutoResumeTimer]);

  useEffect(() => {
    const handleGlobalTouchRelease = () => finishTouchInteraction();

    window.addEventListener("touchend", handleGlobalTouchRelease, { passive: true });
    window.addEventListener("touchcancel", handleGlobalTouchRelease, { passive: true });

    return () => {
      window.removeEventListener("touchend", handleGlobalTouchRelease);
      window.removeEventListener("touchcancel", handleGlobalTouchRelease);
    };
  }, [finishTouchInteraction]);

  useEffect(() => {
    const carousel = carouselRef.current;

    if (!carousel) {
      return;
    }

    const carouselElement = carousel;

    function handleNativeFocusIn(event: Event) {
      if (interactionModeRef.current === "touch" || isRecentTouchInteraction()) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".infinite-3d-testimonials__controls")) {
        releaseControlInteraction();
        return;
      }

      const focusedCard = target?.closest(".infinite-3d-testimonials__card");
      const focusedIndex =
        focusedCard instanceof HTMLElement ? Number(focusedCard.dataset.cardIndex) : NaN;

      interactionModeRef.current = "keyboard";
      setHoveredIndex(Number.isFinite(focusedIndex) ? focusedIndex : null);
      if (Number.isFinite(focusedIndex)) {
        centerCardForReading(focusedIndex);
      } else {
        pauseCarousel();
      }
    }

    function handleNativeFocusOut(event: Event) {
      const focusEvent = event as globalThis.FocusEvent;
      const nextFocusTarget =
        focusEvent.relatedTarget instanceof Node ? focusEvent.relatedTarget : null;

      if (!carouselElement.contains(nextFocusTarget)) {
        interactionModeRef.current = null;
        resumeCarousel();
      }
    }

    carouselElement.addEventListener("focusin", handleNativeFocusIn);
    carouselElement.addEventListener("focusout", handleNativeFocusOut);

    return () => {
      carouselElement.removeEventListener("focusin", handleNativeFocusIn);
      carouselElement.removeEventListener("focusout", handleNativeFocusOut);
    };
  }, [
    centerCardForReading,
    isRecentTouchInteraction,
    pauseCarousel,
    releaseControlInteraction,
    resumeCarousel
  ]);

  useEffect(() => {
    const focusCheckInterval = window.setInterval(() => {
      const carousel = carouselRef.current;
      const activeElement = document.activeElement;
      const focusedInside =
        activeElement instanceof HTMLElement && carousel?.contains(activeElement);

      if (
        focusedInside &&
        interactionModeRef.current !== "touch" &&
        interactionModeRef.current !== "keyboard" &&
        !isRecentTouchInteraction()
      ) {
        const focusedCard = activeElement.closest(".infinite-3d-testimonials__card");
        const focusedIndex =
          focusedCard instanceof HTMLElement ? Number(focusedCard.dataset.cardIndex) : NaN;

        interactionModeRef.current = "keyboard";
        setHoveredIndex(Number.isFinite(focusedIndex) ? focusedIndex : null);
        if (Number.isFinite(focusedIndex)) {
          centerCardForReading(focusedIndex);
        } else {
          pauseCarousel();
        }
        return;
      }

      if (!focusedInside && interactionModeRef.current === "keyboard") {
        interactionModeRef.current = null;
        resumeCarousel();
      }
    }, 180);

    return () => {
      window.clearInterval(focusCheckInterval);
    };
  }, [centerCardForReading, isRecentTouchInteraction, pauseCarousel, resumeCarousel]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      releaseControlInteraction();
      setCarouselDirection(1);
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      releaseControlInteraction();
      setCarouselDirection(-1);
    }
  }

  function isTouchLikePointer(event: PointerEvent<HTMLElement>) {
    return event.pointerType !== "mouse" || window.matchMedia("(pointer: coarse)").matches;
  }

  function isFineHoverPointer() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocusTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;

    if (!carouselRef.current?.contains(nextFocusTarget)) {
      interactionModeRef.current = null;
      resumeCarousel();
    }
  }

  function handleCardPointerDown(event: PointerEvent<HTMLElement>, index: number) {
    const touchLikePointer = isTouchLikePointer(event);

    interactionModeRef.current = touchLikePointer ? "touch" : "mouse";
    if (touchLikePointer) {
      markTouchInteraction();
    }
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      pointerType: touchLikePointer ? "touch" : event.pointerType,
      startProgress: progressRef.current,
      startX: event.clientX,
      startY: event.clientY
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setTouchedIndex(index);
    centerCardForReading(index);

    if (touchLikePointer) {
      clearTouchAutoResumeTimer();
      touchAutoResumeTimerRef.current = window.setTimeout(() => {
        forceResumeFromTouch();
      }, TOUCH_READ_DELAY_MS + RESUME_DELAY_MS);
    }
  }

  function handleCardTouchStart(event: TouchEvent<HTMLElement>, index: number) {
    if (dragRef.current.active && dragRef.current.pointerId !== null) {
      return;
    }

    interactionModeRef.current = "touch";
    markTouchInteraction();
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: null,
      pointerType: "touch",
      startProgress: progressRef.current,
      startX: 0,
      startY: 0
    };
    setTouchedIndex(index);
    centerCardForReading(index);
    clearTouchAutoResumeTimer();
    touchAutoResumeTimerRef.current = window.setTimeout(() => {
      forceResumeFromTouch();
    }, TOUCH_READ_DELAY_MS + RESUME_DELAY_MS);
  }

  function handleCardPointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag.active || drag.pointerId !== event.pointerId || testimonialCount < 2) {
      return;
    }

    const stageWidth = stageRef.current?.clientWidth ?? window.innerWidth;
    const spacing = getCarouselMetrics(stageWidth).spacing;
    const dragDistance = event.clientX - drag.startX;
    const verticalDistance = event.clientY - drag.startY;

    if (Math.abs(dragDistance) > 6 && Math.abs(dragDistance) > Math.abs(verticalDistance)) {
      drag.moved = true;
    }

    if (drag.moved) {
      event.preventDefault();
      centeringRef.current.active = false;
      setIsCentering(false);
      progressRef.current = wrapProgress(
        drag.startProgress - dragDistance / spacing,
        testimonialCount
      );
      applyCardStyles();
    }
  }

  function handleCardPointerUp(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }

    const dragDistance = event.clientX - drag.startX;

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (drag.active && Math.abs(dragDistance) > SWIPE_THRESHOLD_PX) {
      setCarouselDirection(dragDistance < 0 ? 1 : -1);
    }

    resetDragState();
    resumeCarousel(drag.moved ? RESUME_DELAY_MS : TOUCH_READ_DELAY_MS);
  }

  function handleCardPointerCancel(event: PointerEvent<HTMLElement>) {
    if (dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    resetDragState();
    resumeCarousel();
  }

  function handleCardTouchEnd() {
    if (dragRef.current.active && dragRef.current.pointerId !== null) {
      return;
    }

    finishTouchInteraction();
  }

  if (testimonialCount === 0) {
    return null;
  }

  return (
    <div
      aria-label="Wellness community testimonials carousel"
      aria-roledescription="carousel"
      className={[
        "infinite-3d-testimonials",
        isPaused ? "is-paused" : "",
        isCentering ? "is-centering" : "",
        direction === -1 ? "is-moving-right" : "is-moving-left"
      ]
        .filter(Boolean)
        .join(" ")}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      onBlur={handleBlur}
      onFocus={(event) => {
        if (
          event.target === event.currentTarget &&
          interactionModeRef.current !== "touch" &&
          !isRecentTouchInteraction()
        ) {
          interactionModeRef.current = "keyboard";
          pauseCarousel();
        }
      }}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => {
        interactionModeRef.current = null;
        resumeCarousel();
      }}
      onPointerLeave={() => {
        if (!dragRef.current.active) {
          interactionModeRef.current = null;
          resumeCarousel();
        }
      }}
      ref={carouselRef}
      tabIndex={0}
    >
      <div className="infinite-3d-testimonials__stage" ref={stageRef}>
        {testimonials.map((testimonial, index) => {
          const isFocused = hoveredIndex === index || touchedIndex === index;

          return (
            <figure
              aria-label={`Testimonial ${index + 1} of ${testimonialCount}`}
              className={[
                "levelup-whatsapp-testimonial",
                "infinite-3d-testimonials__card",
                "glass-card",
                isFocused ? "is-focused" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              data-card-index={index}
              key={testimonial.src}
              onFocus={() => {
                if (interactionModeRef.current !== "touch" && !isRecentTouchInteraction()) {
                  interactionModeRef.current = "keyboard";
                  setHoveredIndex(index);
                  centerCardForReading(index);
                }
              }}
              onMouseEnter={() => {
                if (!isFineHoverPointer() || isRecentTouchInteraction()) {
                  return;
                }

                interactionModeRef.current = "mouse";
                setHoveredIndex(index);
                centerCardForReading(index);
              }}
              onPointerCancel={handleCardPointerCancel}
              onPointerDown={(event) => handleCardPointerDown(event, index)}
              onPointerEnter={(event) => {
                if (
                  event.pointerType === "mouse" &&
                  isFineHoverPointer() &&
                  !isRecentTouchInteraction()
                ) {
                  interactionModeRef.current = "mouse";
                  setHoveredIndex(index);
                  centerCardForReading(index);
                }
              }}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerUp}
              onTouchCancel={handleCardTouchEnd}
              onTouchEnd={handleCardTouchEnd}
              onTouchStart={(event) => handleCardTouchStart(event, index)}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              tabIndex={0}
            >
              <div className="infinite-3d-testimonials__card-shell">
                <img alt={testimonial.alt} draggable={false} loading="lazy" src={testimonial.src} />
              </div>
            </figure>
          );
        })}
      </div>

      {testimonialCount > 1 ? (
        <div className="infinite-3d-testimonials__controls" aria-label="Carousel controls">
          <button
            aria-label="Set carousel direction to the right"
            aria-pressed={direction === -1}
            className="infinite-3d-testimonials__arrow"
            onClick={() => {
              releaseControlInteraction();
              setCarouselDirection(-1);
            }}
            onFocus={releaseControlInteraction}
            type="button"
          >
            <span aria-hidden="true">{"<"}</span>
          </button>
          <button
            aria-label="Set carousel direction to the left"
            aria-pressed={direction === 1}
            className="infinite-3d-testimonials__arrow"
            onClick={() => {
              releaseControlInteraction();
              setCarouselDirection(1);
            }}
            onFocus={releaseControlInteraction}
            type="button"
          >
            <span aria-hidden="true">{">"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
