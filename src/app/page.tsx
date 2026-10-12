import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Clock3,
  Disc3,
  MapPin,
  Gamepad2,
  Menu,
  Music2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";

import { BookingForm } from "@/components/marketing/booking-form";
import { ThoughtForm } from "@/components/marketing/thought-form";
import { getPublicEvents, getPublicMenu, getPublicThoughts } from "@/lib/dal/content";

const images = {
  hero: "/images/sonique/hero.jpg",
  coffee: "/images/sonique/coffee-bar.jpg",
  affogato: "/images/sonique/affogato.jpg",
  vibe: "/images/sonique/vibe.jpg",
  work: "/images/sonique/montblanc.jpg",
};

export default async function Home() {
  const [menuGroups, upcomingEvents, thoughts] = await Promise.all([
    getPublicMenu(),
    getPublicEvents(),
    getPublicThoughts(),
  ]);

  return (
    <main>
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="shell flex h-24 items-center justify-between text-cream">
          <a href="#" aria-label="Sonique home" className="brand-mark">
            SON<span>ː</span>QUE
          </a>
          <nav className="hidden items-center gap-8 text-sm md:flex" aria-label="Main navigation">
            <a href="#menu">Menu</a>
            <a href="#experience">The experience</a>
            <a href="#thoughts">Thoughts</a>
            <a href="#events">Events</a>
            <a href="#visit">Visit</a>
          </nav>
          <a className="nav-pill hidden sm:inline-flex" href="#booking">
            Book an event
          </a>
          <details className="mobile-menu sm:hidden">
            <summary aria-label="Open navigation">
              <Menu size={25} />
            </summary>
            <nav aria-label="Mobile navigation">
              <a href="#menu">Menu</a>
              <a href="#experience">The experience</a>
              <a href="#thoughts">Thoughts</a>
              <a href="#events">Events</a>
              <a href="#visit">Visit</a>
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
          <div className="hero-photo">
            <Image
              src={images.hero}
              alt="A Sonique barista preparing a hand-brewed coffee"
              fill
              sizes="(max-width: 1023px) 100vw, 46vw"
              priority
              className="object-cover object-[center_40%]"
            />
          </div>
        </div>
      </section>

      <section id="story" className="paper-section overflow-hidden py-24 md:py-36">
        <div className="shell">
          <div className="grid gap-16 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="eyebrow text-olive">Now playing at Sonique</p>
              <Disc3 className="mt-12 animate-slow-spin text-olive/60" size={112} strokeWidth={0.8} />
            </div>
            <div>
              <h2 className="font-display text-[clamp(3.3rem,7vw,7rem)] leading-[0.9] tracking-[-0.045em] text-ink">
                More than a coffee shop.{" "}
                <em className="text-olive">A place to tune in.</em>
              </h2>
              <div className="mt-10 grid gap-8 border-t border-ink/20 pt-8 text-ink/70 md:grid-cols-2">
                <p className="leading-7">
                  We care about what&apos;s in your cup and what&apos;s in the room.
                  Come for carefully brewed coffee, stay for a CD, a book, a game,
                  or a conversation you didn&apos;t plan.
                </p>
                <p className="leading-7">
                  Bring your laptop, bring a friend, or come alone. There&apos;s
                  always something good playing—and space for you in the mix.
                </p>
              </div>
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
          <div className="grid gap-px overflow-hidden rounded-sm bg-cream/15 lg:grid-cols-2">
            {menuGroups.map((group) => (
              <div className="bg-ink p-7 md:p-11" key={group.id}>
                <h3 className="mb-8 flex items-center gap-3 text-sm uppercase tracking-[0.22em] text-sage">
                  <Sparkles size={15} /> {group.name}
                </h3>
                <div>
                  {group.items.map((item) => (
                    <div className="menu-row" key={item.id}>
                      <div>
                        <h4 className="font-display text-2xl">{item.name}</h4>
                        <p className="mt-1 text-sm text-cream/50">{item.description}</p>
                      </div>
                      <span className="font-display text-xl">{item.priceKes}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.18em] text-cream/40">
            All prices in KES · Ask your barista about dietary requirements
          </p>
        </div>
      </section>

      <section id="experience" className="paper-section py-24 md:py-36">
        <div className="shell">
          <div className="grid items-stretch gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative min-h-[32rem] overflow-hidden">
              <Image
                src={images.vibe}
                alt="A listening session at the Sonique decks"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
              <div className="absolute bottom-6 left-6 rounded-full bg-sage px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
                It&apos;s always a vibe
              </div>
            </div>
            <div className="lg:pl-12">
              <p className="eyebrow mb-6 text-olive">Make the space yours</p>
              <h2 className="font-display text-[clamp(3.5rem,7vw,7rem)] leading-[0.88] tracking-[-0.045em]">
                Pick a CD.
                <br />
                <em>Press play.</em>
              </h2>
              <p className="mt-8 max-w-lg text-lg leading-8 text-ink/65">
                Browse the shelf, choose something you love—or something you&apos;ve
                never heard—and settle in. Music isn&apos;t background noise here;
                it&apos;s part of the ritual. Pick up a book, start a game, and
                leave a thought behind before you go.
              </p>
              <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="feature-card">
                  <Music2 size={25} />
                  <p>Curated CDs and dedicated listening stations</p>
                </div>
                <div className="feature-card">
                  <Disc3 size={25} />
                  <p>Community sessions and featured albums</p>
                </div>
                <div className="feature-card">
                  <BookOpen size={25} />
                  <p>A shelf of books to browse, borrow for the moment, and get lost in</p>
                </div>
                <div className="feature-card">
                  <Gamepad2 size={25} />
                  <p>Games for slow afternoons, new friends, and friendly competition</p>
                </div>
                <div className="feature-card col-span-2">
                  <MessageSquareText size={25} />
                  <p>Every guest can leave a thought for the room—and the next person</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="thoughts" className="bg-sage/40 py-24 md:py-32">
        <div className="shell grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow mb-5 text-olive">The wall</p>
            <h2 className="font-display text-[clamp(3.2rem,6vw,6rem)] leading-[0.9] tracking-[-0.04em]">
              Leave a thought.
              <br />
              <em>Read the room.</em>
            </h2>
            <p className="mt-8 max-w-md leading-7 text-ink/65">
              Guests leave a line for whoever sits down next. The café team can
              see every note, and the ones that stay visible live here.
            </p>
            <div className="mt-10 max-w-md">
              <ThoughtForm />
            </div>
          </div>
          <div className="grid content-start gap-4">
            {thoughts.map((thought) => (
              <article className="border border-ink/15 bg-cream p-6" key={thought.id}>
                <p className="font-display text-3xl leading-tight">{thought.body}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-ink/45">
                  {thought.displayName} · {thought.createdAt.toLocaleDateString("en-KE", {
                    dateStyle: "medium",
                    timeZone: "Africa/Nairobi",
                  })}
                </p>
              </article>
            ))}
            {!thoughts.length ? (
              <article className="border border-dashed border-ink/25 p-8">
                <p className="font-display text-4xl">The wall is open.</p>
                <p className="mt-3 text-sm leading-6 text-ink/55">
                  Be the first to leave something for the next guest.
                </p>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <section id="events" className="bg-rust py-24 text-cream md:py-32">
        <div className="shell">
          <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="eyebrow mb-5 text-cream/60">Gather at Sonique</p>
              <h2 className="font-display text-6xl leading-[0.9] md:text-8xl">
                Small room.
                <br />
                <em>Big energy.</em>
              </h2>
              <p className="mt-8 max-w-md leading-7 text-cream/75">
                Listening sessions, conversations, intimate performances and
                community meet-ups. There&apos;s always another reason to gather.
              </p>
              {upcomingEvents.length ? (
                <div className="mt-10 grid gap-3">
                  {upcomingEvents.slice(0, 2).map((item) => (
                    <article className="border-t border-cream/20 pt-4" key={item.id}>
                      <p className="text-xs uppercase tracking-[0.16em] text-cream/55">
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
              <div className="mb-8 flex items-center justify-between border-b border-cream/20 pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cream/55">Host something</p>
                  <h3 className="mt-2 font-display text-4xl">Book the space</h3>
                </div>
                <CalendarDays size={34} strokeWidth={1.2} />
              </div>
              <BookingForm />
            </div>
          </div>
        </div>
      </section>

      <section className="paper-section py-24 md:py-32">
        <div className="shell">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-4 text-olive">From the café</p>
              <h2 className="font-display text-5xl md:text-7xl">In the mix</h2>
            </div>
            <a
              className="hidden items-center gap-2 text-sm font-semibold sm:flex"
              href="https://www.instagram.com/cafe_sonique/"
              target="_blank"
              rel="noreferrer"
            >
              <Camera size={17} /> @cafe_sonique
            </a>
          </div>
          <div className="gallery-grid">
            <div className="gallery-item">
              <Image
                src={images.coffee}
                alt="Coffee being prepared at the Sonique bar"
                fill
                sizes="(max-width: 767px) 100vw, 34vw"
                className="object-cover object-center"
              />
            </div>
            <div className="gallery-item">
              <Image
                src={images.affogato}
                alt="Sonique affogato with espresso and vanilla ice cream"
                fill
                sizes="(max-width: 767px) 100vw, 34vw"
                className="object-cover object-[center_42%]"
              />
            </div>
            <div className="gallery-item">
              <Image
                src={images.work}
                alt="Orange zest over a Mont Blanc at Sonique"
                fill
                sizes="(max-width: 767px) 100vw, 34vw"
                className="object-cover object-[center_58%]"
              />
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
          </div>
        </div>
      </section>

      <footer className="bg-ink py-12 text-cream">
        <div className="shell flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <div>
            <a href="#" className="brand-mark text-3xl">SON<span>ː</span>QUE</a>
            <p className="mt-3 text-sm text-cream/50">Music and Caffeine Society.</p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-cream/70">
            <a href="#menu">Menu</a>
            <a href="#events">Events</a>
            <a href="#visit">Visit</a>
            <a href="https://www.instagram.com/cafe_sonique/" target="_blank" rel="noreferrer">Instagram</a>
          </div>
          <p className="text-xs uppercase tracking-[0.14em] text-cream/35">© 2026 Sonique</p>
        </div>
      </footer>
    </main>
  );
}
