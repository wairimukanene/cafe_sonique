import type { LucideIcon } from "lucide-react";

import type { SitePhoto as SitePhotoRecord, SiteVideo as SiteVideoRecord } from "@/lib/dal/content";
import { SitePhoto } from "./site-photo";

type Props = {
  video: SiteVideoRecord;
  cover: SitePhotoRecord;
  sizes: string;
  className?: string;
  imageClassName?: string;
  placeholderIcon: LucideIcon;
};

export function SiteVideo({ video, cover, sizes, className = "", imageClassName, placeholderIcon }: Props) {
  if (!video.path) {
    return (
      <SitePhoto
        photo={cover}
        className={className}
        sizes={sizes}
        imageClassName={imageClassName}
        placeholderIcon={placeholderIcon}
      />
    );
  }

  return (
    <div className={`site-video relative overflow-hidden ${className}`}>
      <video
        src={video.path}
        poster={cover.path ?? undefined}
        aria-label={video.title}
        title={video.title}
        controls
        playsInline
        preload="metadata"
      />
    </div>
  );
}
