import { useEffect } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
  /** Если родитель сам обрабатывает Escape (например модалка поверх модалки). */
  suppressEscape?: boolean;
};

/**
 * Полноэкранный просмотр: изображение по центру, object-contain (визуально «100%» области просмотра).
 */
export function ImageLightbox({ open, src, alt, onClose, suppressEscape }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || suppressEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, suppressEscape]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        aria-label="Закрыть просмотр"
        onClick={onClose}
      />
      <img
        src={src}
        alt={alt}
        className="relative z-[1] max-h-[100dvh] max-w-full object-contain p-3 sm:p-6"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-[2] rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20"
        aria-label="Закрыть"
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  );
}
