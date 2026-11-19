import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
}

export function ProductImage({ src, fallbackSrc, alt, className = '' }: ProductImageProps) {
  const [stage, setStage] = useState<'primary' | 'remote' | 'fallback'>('primary');

  useEffect(() => {
    setStage('primary');
  }, [src, fallbackSrc]);

  if (stage === 'fallback' || (!src && !fallbackSrc)) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-stone-100 text-stone-400 p-2 text-center ${className}`}
        aria-label={alt}
      >
        <Package className="w-5 h-5 mb-1 stroke-[1.5]" />
        <span className="text-[10px] font-medium text-stone-500 line-clamp-2">{alt}</span>
      </div>
    );
  }

  const activeSrc = stage === 'primary' ? src : fallbackSrc || src;

  return (
    <img
      src={activeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (stage === 'primary' && fallbackSrc && fallbackSrc !== src) {
          setStage('remote');
        } else {
          setStage('fallback');
        }
      }}
      className={className}
    />
  );
}
