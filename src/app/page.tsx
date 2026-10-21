import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Clock3,
  Coffee,
  Croissant,
  Disc3,
  Frame,
  Gamepad2,
  Headphones,
  Leaf,
  MapPin,
  Menu,
  Music2,
  Sparkles,
  UserRound,
} from "lucide-react";

import { BookingForm } from "@/components/marketing/booking-form";
import { BrandMark } from "@/components/marketing/brand-mark";
import { SitePhoto } from "@/components/marketing/site-photo";
import { SiteVideo } from "@/components/marketing/site-video";
import { ThoughtForm } from "@/components/marketing/thought-form";
import {
  getPublicEvents,
  getPublicMenu,
  getPublicPhotos,
  getPublicSiteText,
  getPublicThoughts,
  getPublicVideos,
} from "@/lib/dal/content";
import { paragraphs } from "@/lib/site-text";

const navLinks = [
  { href: "#story", label: "Our story" },
  { href: "#room", label: "Read the room" },
  { href: "#events", label: "Events" },
  { href: "#menu", label: "Menu" },
  { href: "#visit", label: "Visit" },
];

export default async function Home() {
  const [menuGroups, upcomingEvents, thoughts, photos, text, videos] = await Promise.all([
    getPublicMenu(),
    getPublicEvents(),
    getPublicThoughts(),
    getPublicPhotos(),
    getPublicSiteText(),
    getPublicVideos(),
  ]);

  const featuredMenus = [
    { slug: "coffee", photo: photos.espresso, intro: text["menu.espresso"], icon: Coffee, focus: "object-[center_30%]" },
    { slug: "tea", photo: photos.tea, intro: text["menu.tea"], icon: Leaf, focus: "object-[center_40%]" },
    { slug: "pastries", photo: photos.pastries, intro: text["menu.pastries"], icon: Croissant, focus: "object-center" },
  ].flatMap((feature) => {
    const group = menuGroups.find((category) => category.slug === feature.slug);
    return group ? [{ ...feature, group }] : [];
  });
  const otherMenus = menuGroups.filter(
    (category) => !featuredMenus.some((feature) => feature.group.id === category.id),
  );
  const spacePhotos = [photos["space-1"], photos["space-2"], photos["space-3"]];
  const mixCards = [
    { label: "On the decks", caption: text["mix.decks"], photo: photos["mix-decks"], icon: Headphones },
    { label: "On the player", caption: text["mix.player"], photo: photos["mix-player"], icon: Disc3 },
    { label: "On the bar", caption: text["mix.bar"], photo: photos["mix-bar"], icon: Coffee },
  ];

  return (
    <main>
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="shell flex h-24 items-center justify-between text-cream">
          <a href="#" aria-label="Sonique home">
            <BrandMark />
          </a>
          <nav className="hidden items-center gap-8 text-sm md:flex" aria-label="Main navigation">
            {navLinks.map((link) => (
              <a href={link.href} key={link.href}>{link.label}</a>
            ))}
          </nav>
          <a className="nav-pill hidden sm:inline-flex" href="#booking">
            Book an event
          </a>
          <details className="mobile-menu sm:hidden">
            <summary aria-label="Open navigation">
              <Menu size={25} />
            </summary>
            <nav aria-label="Mobile navigation">
              {navLinks.map((link) => (
                <a href={link.href} key={link.href}>{link.label}</a>
              ))}
            </nav>
          </details>
        </div>
      </header>

      <section className="hero">
        <div className="hero-shade" />
        <div className="shell hero-frame relative z-10">
          <div className="flex flex-col justify-end text-cream">
            <p className="eyebrow mb-5">Coffee · Music · Community</p>
            <h1 className="max-w-4xl font-display text-[clamp(4.2rem,8vw,8.5rem)] leading-[0.78] tracking-[-0.06em]">
              Sip slowly.
              <br />
              <em>Listen deeply.</em>
            </h1>
            <div className="mt-10 flex flex-col justify-between gap-8 border-t border-cream/35 pt-6 sm:flex-row sm:items-end">
              <p className="max-w-md text-base leading-7 text-cream/80 md:text-lg">
                A neighbourhood listening café on Getathuru Road. Thoughtful coffee,
                good records and room to stay awhile.
              </p>
              <a className="circle-link" href="#story" aria-label="Discover Sonique">
                <ArrowDown size={25} />
              </a>
            </div>
          </div>
          <SitePhoto
            photo={photos.hero}
            className="hero-photo"
            sizes="(max-width: 1023px) 100vw, 46vw"
            imageClassName="object-cover object-[center_35%]"
            placeholderIcon={Headphones}
            preload
          />
        </div>
      </section>

      <section id="story" className="paper-section overflow-hidden py-24 md:py-36">
        <div className="shell">
          <div className="grid items-start gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <SiteVideo
              video={videos["owner-video"]}
              cover={photos.story}
              className="aspect-[4/5]"
              sizes="(max-width: 1023px) 100vw, 40vw"
              placeholderIcon={UserRound}
            />
            <div className="lg:pt-10">
              <p className="eyebrow text-olive">Meet the founder</p>
              <h2 className="mt-6 font-display text-[clamp(3.3rem,6.5vw,6.5rem)] leading-[0.9] tracking-[-0.045em]">
                {text["story.heading"]}
              </h2>
              <div className="mt-10 grid gap-6 border-t border-ink/20 pt-8 text-lg leading-8 text-ink/70">
                {paragraphs(text["story.body"]).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {text["story.signoff"] ? (
                <p className="mt-8 font-display text-3xl italic">— {text["story.signoff"]}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-20 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="eyebrow text-olive">The space</p>
              <p className="mt-5 max-w-sm font-display text-4xl leading-tight">
                Paintings on the walls, music in the air. Come for a cup, stay for the room.
              </p>
            </div>
            <div className="space-grid">
              {spacePhotos.map((photo, index) => (
                <SitePhoto
                  key={index}
                  photo={photo}
                  className={index === 0 ? "space-item space-item-lead" : "space-item"}
                  sizes="(max-width: 767px) 100vw, 30vw"
                  placeholderIcon={Frame}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="menu" className="bg-ink py-24 text-cream md:py-36">
        <div className="shell">
          <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-5 text-sage">On the menu</p>
              <h2 className="font-display text-6xl leading-none tracking-tight md:text-8xl">
                Coffee with <em>range.</em>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-cream/60">
              A small, considered menu. Prices shown are provisional and will be
              confirmed with the café before launch.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden bg-cream/15 lg:grid-cols-3">
            {featuredMenus.map(({ group, photo, intro, icon, focus }) => (
              <article className="menu-feature" key={group.id}>
                <SitePhoto
                  photo={photo}
                  className="aspect-[5/4]"
                  sizes="(max-width: 1023px) 100vw, 33vw"
                  imageClassName={`object-cover ${focus}`}
                  placeholderIcon={icon}
                />
                <div className="p-7 md:p-9">
                  <h3 className="font-display text-5xl">{group.name}</h3>
                  <p className="mt-4 max-w-md text-sm leading-6 text-cream/65">{intro}</p>
                  <div className="mt-8">
                    {group.items.map((item) => (
                      <MenuRow item={item} key={item.id} />
                    ))}
                    {group.items.length === 0 ? (
                      <p className="border-t border-cream/15 pt-5 text-sm text-cream/50">
                        Ask at the bar for today’s selection.
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {otherMenus.map((group) => (
            <article className="menu-wide" key={group.id}>
              <div className="p-7 md:p-11">
                <h3 className="mb-8 flex items-center gap-3 text-sm uppercase tracking-[0.22em] text-sage">
                  <Sparkles size={15} /> {group.name}
                </h3>
                <div className="grid gap-x-12 md:grid-cols-2">
                  {group.items.map((item) => (
                    <MenuRow item={item} key={item.id} />
                  ))}
                </div>
              </div>
            </article>
          ))}

          <p className="mt-5 text-xs uppercase tracking-[0.18em] text-cream/40">
            All prices in KES · Ask your barista about dietary requirements
          </p>
        </div>
      </section>

      <section id="room" className="paper-section py-24 md:py-36">
        <div className="shell">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="eyebrow mb-6 text-olive">Music at Sonique</p>
              <h2 className="font-display text-[clamp(3.8rem,8vw,8rem)] leading-[0.85] tracking-[-0.05em]">
                Read <em>the room.</em>
              </h2>
            </div>
            <p className="max-w-lg text-lg leading-8 text-ink/65">
              Music isn&apos;t background noise here; it&apos;s part of the ritual.
              Whoever&apos;s on the decks plays to the people in the room, and the
              shelf is open: pick a CD, press play, and settle in.
            </p>
          </div>

          <div className="mt-16">
            <p className="eyebrow mb-6 text-olive">In the Mix</p>
            <div className="gallery-grid">
              {mixCards.map(({ label, caption, photo, icon }) => (
                <figure className="mix-card" key={label}>
                  <SitePhoto
                    photo={photo}
                    className="gallery-item"
                    sizes="(max-width: 767px) 100vw, 34vw"
                    placeholderIcon={icon}
                  />
                  <figcaption>
                    <span className="eyebrow text-olive">{label}</span>
                    <span className="mt-2 block font-display text-2xl leading-tight">{caption}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            <div className="feature-card">
              <Music2 size={25} />
              <p>Curated CDs and dedicated listening stations</p>
            </div>
            <div className="feature-card">
              <BookOpen size={25} />
              <p>A shelf of books to browse and get lost in</p>
            </div>
            <div className="feature-card">
              <Gamepad2 size={25} />
              <p>Games for slow afternoons and new friends</p>
            </div>
          </div>

          <div id="thoughts" className="thought-strip">
            <div>
              <h3 className="font-display text-4xl">Leave a thought.</h3>
              <p className="mt-2 text-sm leading-6 text-ink/55">A line for whoever sits here next.</p>
              <div className="mt-6">
                <ThoughtForm />
              </div>
            </div>
            <div className="grid content-start gap-3">
              {thoughts.slice(0, 3).map((thought) => (
                <blockquote className="border-l-2 border-olive/50 pl-5" key={thought.id}>
                  <p className="font-display text-2xl leading-snug">{thought.body}</p>
                  <footer className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/45">
                    {thought.displayName}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="barista" className="bg-sage/50 py-24 md:py-32">
        <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <SiteVideo
            video={videos["barista-video"]}
            cover={photos.barista}
            className="aspect-[4/5] max-h-[44rem]"
            sizes="(max-width: 1023px) 100vw, 50vw"
            imageClassName="object-cover object-[center_30%]"
            placeholderIcon={UserRound}
          />
          <div>
            <p className="eyebrow mb-6 text-olive">Behind the bar</p>
            <h2 className="font-display text-[clamp(3.3rem,6vw,6rem)] leading-[0.9] tracking-[-0.04em]">
              Meet the barista{text["barista.name"] ? <>: <em>{text["barista.name"]}</em></> : "."}
            </h2>
            <div className="mt-8 grid max-w-lg gap-5 text-lg leading-8 text-ink/70">
              {paragraphs(text["barista.bio"]).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="events" className="bg-rust py-24 text-ink md:py-32">
        <div className="shell">
          <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="eyebrow mb-5 text-ink/60">Gather at Sonique</p>
              <h2 className="font-display text-6xl leading-[0.9] md:text-8xl">
                Small room.
                <br />
                <em>Big energy.</em>
              </h2>
              <p className="mt-8 max-w-md leading-7 text-ink/75">
                Listening sessions, conversations, intimate performances and
                community meet-ups. There&apos;s always another reason to gather.
              </p>
              {upcomingEvents.length ? (
                <div className="mt-10 grid gap-3">
                  {upcomingEvents.slice(0, 2).map((item) => (
                    <article className="border-t border-ink/20 pt-4" key={item.id}>
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/55">
                        {item.startsAt.toLocaleDateString("en-KE", {
                          dateStyle: "medium",
                          timeZone: "Africa/Nairobi",
                        })}
                      </p>
                      <h3 className="mt-2 font-display text-2xl">{item.title}</h3>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            <div id="booking" className="booking-card">
              <div className="mb-8 flex items-center justify-between border-b border-ink/15 pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Host something</p>
                  <h3 className="mt-2 font-display text-4xl">Book the space</h3>
                </div>
                <CalendarDays size={34} strokeWidth={1.2} />
              </div>
              <BookingForm />
            </div>
          </div>
        </div>
      </section>

      <section id="visit" className="bg-sage py-24 text-ink md:py-32">
        <div className="shell grid gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow mb-5 text-olive">Come through</p>
            <h2 className="font-display text-[clamp(4rem,8vw,8rem)] leading-[0.83] tracking-[-0.05em]">
              Your table
              <br />
              is <em>waiting.</em>
            </h2>
          </div>
          <div className="flex flex-col justify-end">
            <div className="visit-row">
              <MapPin size={22} />
              <div>
                <p className="label">Find us</p>
                <p>Getathuru Road, Nairobi</p>
              </div>
            </div>
            <div className="visit-row">
              <Clock3 size={22} />
              <div>
                <p className="label">Opening hours</p>
                <p>8am–9pm</p>
              </div>
            </div>
            <a
              className="mt-8 inline-flex items-center justify-between border-b border-ink pb-3 font-semibold"
              href="https://maps.app.goo.gl/KMn6SVFFHPxpDDSM6?g_st=ic"
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps <ArrowRight size={19} />
            </a>
            <a
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold"
              href="https://www.instagram.com/cafe_sonique/"
              target="_blank"
              rel="noreferrer"
            >
              <Camera size={17} /> @cafe_sonique
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-ink py-12 text-cream">
        <div className="shell flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <div>
            <a href="#" aria-label="Sonique home">
              <BrandMark />
            </a>
            <p className="mt-3 text-sm text-cream/50">Music and Caffeine Society.</p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-cream/70">
            <a href="#story">Our story</a>
            <a href="#events">Events</a>
            <a href="#menu">Menu</a>
            <a href="#visit">Visit</a>
            <a href="https://www.instagram.com/cafe_sonique/" target="_blank" rel="noreferrer">Instagram</a>
          </div>
          <p className="text-xs uppercase tracking-[0.14em] text-cream/35">© 2026 Sonique</p>
        </div>
      </footer>
    </main>
  );
}

type MenuItemRecord = Awaited<ReturnType<typeof getPublicMenu>>[number]["items"][number];

function MenuRow({ item }: { item: MenuItemRecord }) {
  return (
    <div className="menu-row">
      <div>
        <h4 className="font-display text-2xl">{item.name}</h4>
        <p className="mt-1 text-sm text-cream/50">{item.description}</p>
      </div>
      <span className="font-display text-xl">{item.priceKes}</span>
    </div>
  );
}
