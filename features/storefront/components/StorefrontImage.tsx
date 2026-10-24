import Image from 'next/image';

const SAFE_IMAGE_PATH = /^\/images\/[a-zA-Z0-9/_-]+\.(?:avif|gif|jpe?g|png|svg|webp)$/;

/** Uploaded images are served from the shop's own S3 storage host only. */
function isStorageUrl(src: string) {
  try {
    const url = new URL(src);
    const endpoint = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).hostname : '';
    return url.protocol === 'https:' && Boolean(endpoint) && (url.hostname === endpoint || url.hostname.endsWith(`.${endpoint}`));
  } catch { return false; }
}

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
  const uploaded = Boolean(src && isStorageUrl(src));
  const safeSrc = src && (SAFE_IMAGE_PATH.test(src) || uploaded) ? src : fallbackSrc;

  return (
    <div className={['sf-image', className].filter(Boolean).join(' ')}>
      <Image
        src={safeSrc}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        // Signed storage URLs expire, so they are not cached by the optimizer.
        unoptimized={uploaded}
        className={['object-cover', imageClassName].filter(Boolean).join(' ')}
      />
    </div>
  );
}
