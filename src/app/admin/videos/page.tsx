import { VideoSlotForm } from "@/components/admin/video-slot-form";
import { getStaffPhotos, getStaffVideos } from "@/lib/dal/content";
import { videoSlots } from "@/lib/media/slots";

export const instant = false;

export default async function VideosPage() {
  const [videos, photos] = await Promise.all([getStaffVideos(), getStaffPhotos()]);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Public website</p>
          <h1 className="dashboard-title">Videos</h1>
        </div>
      </header>
      <p className="mb-8 max-w-2xl text-sm leading-6 text-ink/60">
        Upload the founder and barista videos. Each one starts with its cover
        photo, which you can change on the Photos page.
      </p>
      <div className="grid gap-4">
        {videoSlots.map((slot) => {
          const video = videos[slot.key];
          const customised = video.updatedAt !== null && video.path !== slot.defaultPath;
          return (
            <VideoSlotForm
              key={slot.key}
              slot={{ key: slot.key, label: slot.label, placement: slot.placement }}
              current={video}
              coverPath={photos[slot.coverSlot].path}
              removeLabel={
                customised ? (slot.defaultPath ? "Go back to the original video" : "Remove video") : null
              }
            />
          );
        })}
      </div>
    </main>
  );
}
