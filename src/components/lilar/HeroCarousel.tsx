import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroSlide {
  src: string;
  title: string;
  href?: string;
}

type Props = {
  slides: HeroSlide[];
  onImageError: (e: SyntheticEvent<HTMLImageElement>) => void;
  autoplayMs?: number;
};

/**
 * Герой-карусель в духе Splide на lilar.ru: широкий баннер, стрелки по бокам, точки снизу, автоплей.
 */
export function HeroCarousel({ slides, onImageError, autoplayMs = 5500 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  const go = useCallback(
    (dir: -1 | 1) => {
      if (n <= 1) return;
      setIndex((i) => (i + dir + n) % n);
    },
    [n]
  );

  useEffect(() => {
    if (n <= 1 || paused) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, autoplayMs);
    return () => window.clearInterval(t);
  }, [n, paused, autoplayMs]);

  if (n === 0) return null;

  return (
    <div
      className="relative w-full select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-xl border border-[var(--lilar-border)] bg-neutral-200 shadow-md">
        <div className="relative aspect-[2.96/1] min-h-[190px] sm:min-h-[216px] lg:min-h-[243px]">
          {slides.map((slide, i) => (
            <div
              key={`${slide.src}-${i}`}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                i === index ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'
              }`}
              aria-hidden={i !== index}
            >
              <img
                src={slide.src}
                alt=""
                className="h-full w-full object-cover"
                onError={onImageError}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
              <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 lg:p-10">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl line-clamp-3">
                    {slide.title}
                  </h2>
                  {slide.href ? (
                    <a
                      href={slide.href}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-[var(--lilar-primary)] shadow-md transition hover:bg-white"
                    >
                      В каталог
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {n > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-1.5 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/90 text-neutral-800 shadow transition hover:bg-white sm:left-2 sm:h-9 sm:w-9"
              aria-label="Предыдущий слайд"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-1.5 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/90 text-neutral-800 shadow transition hover:bg-white sm:right-2 sm:h-9 sm:w-9"
              aria-label="Следующий слайд"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div
              className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5"
              role="tablist"
              aria-label="Выбор слайда"
            >
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Слайд ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? 'w-6 bg-white shadow'
                      : 'w-1.5 bg-white/45 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
