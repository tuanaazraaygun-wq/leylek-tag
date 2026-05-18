"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";

type BrandingImageProps = Omit<ImageProps, "src" | "onError"> & {
  /** Soldan sağa denenen kaynaklar; sonuncuya kadar onError ile ilerlenir. */
  sources: string[];
};

export function BrandingImage({ sources, alt, className, ...rest }: BrandingImageProps) {
  const [index, setIndex] = useState(0);
  const max = sources.length - 1;
  const safeIndex = Math.min(index, max);
  const src = sources[safeIndex] ?? sources[0];

  const onError = useCallback(() => {
    setIndex((i) => Math.min(i + 1, max));
  }, [max]);

  return (
    <Image
      {...rest}
      src={src}
      alt={alt}
      className={className}
      onError={safeIndex < max ? onError : undefined}
    />
  );
}
