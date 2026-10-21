import Image from "next/image";
import type { LucideIcon } from "lucide-react";

import type { SitePhoto as SitePhotoRecord } from "@/lib/dal/content";

type Props = {
  photo: SitePhotoRecord;
  sizes: string;
  className?: string;
  imageClassName?: string;
  placeholderIcon: LucideIcon;
  preload?: boolean;
};

export function SitePhoto({
  photo,
  sizes,
  className = "",
  imageClassName = "object-cover object-center",
  placeholderIcon: Icon,
  preload,
}: Props) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {photo.path ? (
        <Image
          src={photo.path}
          alt={photo.altText}
          fill
          sizes={sizes}
          preload={preload}
          className={imageClassName}
        />
      ) : (
        <div className="photo-placeholder" role="img" aria-label={photo.altText}>
          <Icon size={42} strokeWidth={1} />
        </div>
      )}
    </div>
  );
}
