import { PhotoSlotForm } from "@/components/admin/photo-slot-form";
import { getStaffPhotos } from "@/lib/dal/content";
import { photoSlots } from "@/lib/media/slots";

export const instant = false;

export default async function PhotosPage() {
  const photos = await getStaffPhotos();
  const sections = [...new Set(photoSlots.map((slot) => slot.section))];

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Public website</p>
          <h1 className="dashboard-title">Photos</h1>
        </div>
      </header>
      <p className="mb-8 max-w-2xl text-sm leading-6 text-ink/60">
        Choose a photo straight from your phone or computer. It is resized
        automatically and appears on the website as soon as you publish it.
      </p>
      {sections.map((section) => (
        <section className="mb-12" key={section}>
          <h2 className="eyebrow mb-4 text-olive">{section}</h2>
          <div className="grid gap-4">
            {photoSlots
              .filter((slot) => slot.section === section)
              .map((slot) => {
                const photo = photos[slot.key];
                const customised = photo.updatedAt !== null && photo.path !== slot.defaultPath;
                return (
                  <PhotoSlotForm
                    key={slot.key}
                    slot={{ key: slot.key, label: slot.label, placement: slot.placement }}
                    current={{ path: photo.path, altText: photo.altText }}
                    removeLabel={
                      customised ? (slot.defaultPath ? "Go back to the original photo" : "Remove photo") : null
                    }
                  />
                );
              })}
          </div>
        </section>
      ))}
    </main>
  );
}
