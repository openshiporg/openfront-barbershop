import Image from 'next/image';

const SAFE_IMAGE_PATH = /^\/images\/[a-zA-Z0-9/_-]+\.(?:avif|gif|jpe?g|png|svg|webp)$/;

type StorefrontImageProps = {
  src?: string | null;
  fallbackSrc: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
};

export function StorefrontImage({
  src,
  fallbackSrc,
  alt,
  className,
  imageClassName,
  priority = false,
  sizes = '(max-width: 768px) 100vw, 50vw',
}: StorefrontImageProps) {
  const safeSrc = src && SAFE_IMAGE_PATH.test(src) ? src : fallbackSrc;

  return (
    <div className={['relative overflow-hidden bg-[var(--color-paper-2)]', className].filter(Boolean).join(' ')}>
      <Image
        src={safeSrc}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={['object-cover', imageClassName].filter(Boolean).join(' ')}
      />
    </div>
  );
}
