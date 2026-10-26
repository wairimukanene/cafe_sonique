export type SiteTextField = {
  key: string;
  section: string;
  label: string;
  hint?: string;
  defaultValue: string;
  maxLength: number;
  multiline?: boolean;
};

export const siteTextFields = [
  {
    key: "story.heading",
    section: "The story behind Sonique",
    label: "Heading",
    defaultValue: "A room built for listening.",
    maxLength: 80,
  },
  {
    key: "story.body",
    section: "The story behind Sonique",
    label: "The story",
    hint: "Leave a blank line between paragraphs.",
    defaultValue:
      "Sonique started with a simple idea: a café where the music matters as much as the coffee.\n\nEvery corner of the room – the paintings on the walls, the CDs on the shelf, the cups on the bar – is chosen to make it somewhere you want to stay a while.",
    maxLength: 1500,
    multiline: true,
  },
  {
    key: "story.signoff",
    section: "The story behind Sonique",
    label: "Founder’s name",
    hint: "Shown under the story. Leave empty to hide.",
    defaultValue: "",
    maxLength: 80,
  },
  {
    key: "menu.espresso",
    section: "Menu",
    label: "Coffee introduction",
    defaultValue:
      "The anchor of the bar: espresso, milk drinks, slow pour-overs and our signature iced coffees, made with care.",
    maxLength: 240,
    multiline: true,
  },
  {
    key: "menu.tea",
    section: "Menu",
    label: "Tea introduction",
    defaultValue:
      "Blended by hand, in-house. Our teas get the same attention as the espresso – ask at the bar what’s steeping today.",
    maxLength: 240,
    multiline: true,
  },
  {
    key: "menu.pastries",
    section: "Menu",
    label: "Pastries introduction",
    defaultValue: "Baked fresh for the counter, to go with whatever’s in your cup.",
    maxLength: 240,
    multiline: true,
  },
  {
    key: "mix.decks",
    section: "In the Mix",
    label: "On the decks",
    defaultValue: "Whoever’s on tonight reads the room, then presses play.",
    maxLength: 140,
  },
  {
    key: "mix.player",
    section: "In the Mix",
    label: "On the player",
    defaultValue: "Pick a CD from the shelf and it goes on next.",
    maxLength: 140,
  },
  {
    key: "mix.bar",
    section: "In the Mix",
    label: "On the bar (bestseller)",
    defaultValue: "Mont Blanc – iced coffee under citrus cream.",
    maxLength: 140,
  },
  {
    key: "barista.name",
    section: "Meet the barista",
    label: "Name",
    hint: "Leave empty to show “Meet the barista” only.",
    defaultValue: "Ronnie",
    maxLength: 60,
  },
  {
    key: "barista.bio",
    section: "Meet the barista",
    label: "About them",
    defaultValue:
      "Behind the bar is someone who cares about every cup, from the first espresso of the morning to the teas blended in-house.",
    maxLength: 600,
    multiline: true,
  },
] as const satisfies readonly SiteTextField[];

export type SiteTextKey = (typeof siteTextFields)[number]["key"];
export type SiteText = Record<SiteTextKey, string>;

export const SITE_TEXT_PREFIX = "site.";

export function siteTextDefaults(): SiteText {
  return Object.fromEntries(siteTextFields.map((field) => [field.key, field.defaultValue])) as SiteText;
}

export function paragraphs(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
