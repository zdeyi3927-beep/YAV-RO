import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface SpreadsheetScrollWrapperProps {
  children: ReactNode;
  depKey?: unknown;
}

export function SpreadsheetScrollWrapper({
  children,
  depKey,
}: SpreadsheetScrollWrapperProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<number | null>(null);

  const [metrics, setMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 1,
    clientWidth: 1,
  });

  const syncMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setMetrics({
      scrollLeft: el.scrollLeft,
      scrollWidth: Math.max(1, el.scrollWidth),
      clientWidth: Math.max(1, el.clientWidth),
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    syncMetrics();

    const ro = new ResizeObserver(() => {
      syncMetrics();
    });
    ro.observe(el);
    if (el.firstElementChild) {
      ro.observe(el.firstElementChild);
    }
    return () => ro.disconnect();
  }, [syncMetrics, depKey]);

  const maxScroll = Math.max(0, metrics.scrollWidth - metrics.clientWidth);
  const hasOverflow = maxScroll > 2;
  const thumbRatio = hasOverflow
    ? Math.max(0.12, Math.min(1, metrics.clientWidth / metrics.scrollWidth))
    : 1;
  const thumbLeftPercent =
    hasOverflow && maxScroll > 0
      ? (metrics.scrollLeft / maxScroll) * (1 - thumbRatio) * 100
      : 0;
  const thumbWidthPercent = thumbRatio * 100;

  const canScrollLeft = metrics.scrollLeft > 1;
  const canScrollRight = metrics.scrollLeft < maxScroll - 1;

  const holdDelayRef = useRef<number | null>(null);

  const stopHold = useCallback(() => {
    if (holdDelayRef.current !== null) {
      window.clearTimeout(holdDelayRef.current);
      holdDelayRef.current = null;
    }
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const stepScroll = useCallback((delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const startHoldScroll = (deltaPerTick: number) => {
    stopHold();
    holdDelayRef.current = window.setTimeout(() => {
      holdTimerRef.current = window.setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft += deltaPerTick;
        }
      }, 40);
    }, 220);
  };

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track || !hasOverflow) return;
    // Ignore if clicking directly on the thumb
    if ((e.target as HTMLElement).dataset.thumb === 'true') return;

    const rect = track.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetLeft = clickRatio * maxScroll;
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track || !hasOverflow) return;

    const startX = e.clientX;
    const startScrollLeft = el.scrollLeft;
    const trackWidth = track.getBoundingClientRect().width;
    const thumbWidthPx = trackWidth * thumbRatio;
    const availableTrackPx = Math.max(1, trackWidth - thumbWidthPx);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const scrollDelta = (dx / availableTrackPx) * maxScroll;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startScrollLeft + scrollDelta));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        onScroll={syncMetrics}
        className="overflow-x-auto no-native-hscroll"
      >
        {children}
      </div>

      {/* Excel-style bottom horizontal scrollbar with left/right arrows */}
      <div
        className="h-[18px] bg-[#f1f1f1] border-t border-slate-200 flex items-center select-none no-print"
        aria-label="រំកិលតារាងឆ្វេងស្តាំ"
      >
        <button
          type="button"
          onMouseDown={() => startHoldScroll(-36)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onClick={() => stepScroll(-160)}
          disabled={!canScrollLeft}
          title="រំកិលទៅឆ្វេង"
          className={`w-[22px] h-full flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-default ${
            canScrollLeft
              ? 'text-[#444] hover:bg-[#e2e2e2]'
              : 'text-[#b5b5b5]'
          }`}
        >
          <svg width="7" height="10" viewBox="0 0 7 10" fill="currentColor" aria-hidden="true">
            <path d="M6 1L1 5l5 4V1z" />
          </svg>
        </button>

        <div
          ref={trackRef}
          onMouseDown={handleTrackMouseDown}
          className="relative flex-1 h-[12px] mx-0.5 bg-[#f1f1f1] cursor-pointer"
        >
          <div
            data-thumb="true"
            onMouseDown={handleThumbMouseDown}
            style={{
              left: `${thumbLeftPercent}%`,
              width: `${thumbWidthPercent}%`,
            }}
            className={`absolute top-0 bottom-0 transition-colors ${
              hasOverflow
                ? 'bg-[#c1c1c1] hover:bg-[#a6a6a6] active:bg-[#8e8e8e] cursor-grab active:cursor-grabbing'
                : 'bg-[#d8d8d8]'
            }`}
          />
        </div>

        <button
          type="button"
          onMouseDown={() => startHoldScroll(36)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onClick={() => stepScroll(160)}
          disabled={!canScrollRight}
          title="រំកិលទៅស្តាំ"
          className={`w-[22px] h-full flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-default ${
            canScrollRight
              ? 'text-[#444] hover:bg-[#e2e2e2]'
              : 'text-[#b5b5b5]'
          }`}
        >
          <svg width="7" height="10" viewBox="0 0 7 10" fill="currentColor" aria-hidden="true">
            <path d="M1 1l5 4-5 4V1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
