export const MAX_PHOTO_BYTES = 950 * 1024;

export const photoSlotKeys = [
  "hero",
  "story",
  "space-1",
  "space-2",
  "space-3",
  "espresso",
  "tea",
  "pastries",
  "mix-decks",
  "mix-player",
  "mix-bar",
  "barista",
] as const;

export type PhotoSlotKey = (typeof photoSlotKeys)[number];

export type PhotoSlot = {
  key: PhotoSlotKey;
  section: string;
  label: string;
  placement: string;
  defaultPath: string | null;
  defaultAlt: string;
};

export const photoSlots: PhotoSlot[] = [
  {
    key: "hero",
    section: "Top of the page",
    label: "Main photo",
    placement: "The large photo beside “Sip slowly. Listen deeply.”",
    defaultPath: "/images/sonique/vibe.jpg",
    defaultAlt: "A DJ in headphones at the Sonique decks, surrounded by CDs",
  },
  {
    key: "story",
    section: "Meet the founder",
    label: "Founder video cover",
    placement: "Shown before the founder video plays, or on its own if there is no video yet.",
    defaultPath: "/images/sonique/bar-sign.jpg",
    defaultAlt: "The Sonique bar, with the espresso machine and pastry counter",
  },
  {
    key: "space-1",
    section: "The space",
    label: "The space 1",
    placement: "Row of photos of the room, paintings and details.",
    defaultPath: "/images/sonique/bar-room.jpg",
    defaultAlt: "A guest ordering at the Sonique bar",
  },
  {
    key: "space-2",
    section: "The space",
    label: "The space 2",
    placement: "Row of photos of the room, paintings and details.",
    defaultPath: "/images/sonique/paintings.jpg",
    defaultAlt: "Paintings, plants and a quiet corner inside Sonique",
  },
  {
    key: "space-3",
    section: "The space",
    label: "The space 3",
    placement: "Row of photos of the room, paintings and details.",
    defaultPath: "/images/sonique/espresso-machine.jpg",
    defaultAlt: "The orange espresso machine and grinder at Sonique",
  },
  {
    key: "espresso",
    section: "Menu",
    label: "Coffee",
    placement: "Top of the Coffee menu.",
    defaultPath: "/images/sonique/coffee.jpg",
    defaultAlt: "A Sonique barista pouring a V60 pour-over",
  },
  {
    key: "tea",
    section: "Menu",
    label: "Tea",
    placement: "Top of the Tea menu.",
    defaultPath: "/images/sonique/tea-pot.jpg",
    defaultAlt: "A pot of Sonique house tea beside the decks",
  },
  {
    key: "pastries",
    section: "Menu",
    label: "Pastries",
    placement: "Top of the Pastries menu.",
    defaultPath: "/images/sonique/pastries.jpg",
    defaultAlt: "Pastries and coffee beside a CD player at Sonique",
  },
  {
    key: "mix-decks",
    section: "In the Mix",
    label: "On the decks",
    placement: "First card in “In the Mix” – the DJ.",
    defaultPath: "/images/sonique/dj-decks.jpg",
    defaultAlt: "A DJ in headphones on the decks at Sonique",
  },
  {
    key: "mix-player",
    section: "In the Mix",
    label: "On the player",
    placement: "Second card in “In the Mix” – the CD player.",
    defaultPath: "/images/sonique/cd-listening.jpg",
    defaultAlt: "A guest in headphones choosing a track on the Sonique CD player",
  },
  {
    key: "mix-bar",
    section: "In the Mix",
    label: "On the bar",
    placement: "Third card in “In the Mix” – the bestseller.",
    defaultPath: "/images/sonique/montblanc.jpg",
    defaultAlt: "Orange zest over a Mont Blanc at Sonique",
  },
  {
    key: "barista",
    section: "Meet the barista",
    label: "Barista video cover",
    placement: "Shown before the barista video plays, or on its own if there is no video yet.",
    defaultPath: "/images/sonique/hero.jpg",
    defaultAlt: "A Sonique barista smiling behind the bar",
  },
];

export function findPhotoSlot(key: string) {
  return photoSlots.find((slot) => slot.key === key) ?? null;
}

export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

export const videoSlotKeys = ["owner-video", "barista-video"] as const;

export type VideoSlotKey = (typeof videoSlotKeys)[number];

export type VideoSlot = {
  key: VideoSlotKey;
  label: string;
  placement: string;
  coverSlot: PhotoSlotKey;
  defaultTitle: string;
};

export const videoSlots: VideoSlot[] = [
  {
    key: "owner-video",
    label: "Meet the founder",
    placement: "The founder telling the Sonique story, beside “Meet the founder”.",
    coverSlot: "story",
    defaultTitle: "The founder of Sonique tells the story of the café",
  },
  {
    key: "barista-video",
    label: "Meet the barista",
    placement: "The barista video in the “Meet the barista” section.",
    coverSlot: "barista",
    defaultTitle: "Meet the Sonique barista",
  },
];

export function findVideoSlot(key: string) {
  return videoSlots.find((slot) => slot.key === key) ?? null;
}

export type SiteVideoType = "mp4" | "mov" | "webm";

export function detectVideoType(bytes: Uint8Array): SiteVideoType | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "webm";
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
    return ascii(8, 12) === "qt  " ? "mov" : "mp4";
  }
  return null;
}

export type SitePhotoType = "jpg" | "png" | "webp";

export function detectImageType(bytes: Uint8Array): SitePhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  ) {
    return "png";
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}
