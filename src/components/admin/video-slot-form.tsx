"use client";

import { ChangeEvent, FormEvent, useRef, useState, useTransition } from "react";
import { Film, LoaderCircle, Save, Trash2, Upload } from "lucide-react";

import { removeSiteVideo, saveSiteVideo } from "@/app/admin/actions";
import type { ActionState } from "@/app/dashboard/actions";
import { MAX_VIDEO_BYTES, type VideoSlot } from "@/lib/media/slots";

type Props = {
  slot: Pick<VideoSlot, "key" | "label" | "placement">;
  current: { path: string | null; title: string };
  coverPath: string | null;
  removeLabel: string | null;
};

const acceptedTypes = ["video/mp4", "video/quicktime", "video/webm"];

function uploadVideo(file: File, onProgress: (fraction: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/videos");
    request.setRequestHeader("x-sonique-upload", "1");
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      let body: { path?: string; message?: string } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {}
      if (request.status === 200 && body.path) resolve(body.path);
      else reject(new Error(body.message ?? "The upload failed. Please try again."));
    };
    request.onerror = () => reject(new Error("The connection dropped. Please try again."));
    request.send(file);
  });
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoSlotForm({ slot, current, coverPath, removeLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [state, setState] = useState<ActionState>({ ok: false, message: "" });
  const [saving, startSaving] = useTransition();

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setState({ ok: false, message: "" });
    if (chosen && chosen.type && !acceptedTypes.includes(chosen.type)) {
      event.target.value = "";
      setFile(null);
      setState({ ok: false, message: "Please choose an MP4, MOV or WebM video." });
      return;
    }
    if (chosen && chosen.size > MAX_VIDEO_BYTES) {
      event.target.value = "";
      setFile(null);
      setState({ ok: false, message: `That video is ${formatSize(chosen.size)}. Please keep it under 250 MB.` });
      return;
    }
    setFile(chosen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("video");
    setState({ ok: false, message: "" });

    if (file) {
      try {
        setProgress(0);
        formData.set("path", await uploadVideo(file, setProgress));
      } catch (error) {
        setProgress(null);
        setState({ ok: false, message: error instanceof Error ? error.message : "The upload failed." });
        return;
      }
    }

    startSaving(async () => {
      const result = await saveSiteVideo({ ok: false, message: "" }, formData);
      setProgress(null);
      setState(result);
      if (result.ok) {
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleRemove() {
    const formData = new FormData();
    formData.set("key", slot.key);
    startSaving(async () => {
      setState(await removeSiteVideo({ ok: false, message: "" }, formData));
    });
  }

  const uploading = progress !== null && !saving;
  const busy = uploading || saving;

  return (
    <article className="dashboard-panel photo-slot">
      <div className="photo-slot-preview video-slot-preview">
        {current.path ? (
          <video
            key={current.path}
            src={current.path}
            poster={coverPath ?? undefined}
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="photo-slot-empty">
            <Film size={28} />
            <p>No video yet. The cover photo shows on the website instead.</p>
          </div>
        )}
      </div>

      <form className="dashboard-form" onSubmit={handleSubmit}>
        <div>
          <h2 className="font-display text-3xl">{slot.label}</h2>
          <p className="mt-1 text-sm text-ink/55">{slot.placement}</p>
        </div>
        <input name="key" type="hidden" value={slot.key} />
        <label>
          Choose a new video
          <input
            ref={inputRef}
            name="video"
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleFileChange}
            disabled={busy}
          />
        </label>
        {file ? (
          <p className="text-sm text-ink/60">
            {file.name} · {formatSize(file.size)}
          </p>
        ) : null}
        {progress !== null ? (
          <div className="upload-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        ) : null}
        <label>
          Describe the video (for screen readers and Google)
          <input name="title" defaultValue={current.title} maxLength={200} required />
        </label>
        <p className="text-xs leading-5 text-ink/50">
          Best results: MP4, filmed upright or landscape, under 2 minutes. Videos
          straight from a phone work too, they just take longer to upload.
        </p>
        {state.message ? (
          <p className={state.ok ? "form-success" : "form-error"} role="status">
            {state.message}
          </p>
        ) : null}
        <button className="staff-primary-button" disabled={busy || (!current.path && !file)} type="submit">
          {busy ? <LoaderCircle className="animate-spin" size={17} /> : file ? <Upload size={17} /> : <Save size={17} />}
          {uploading
            ? `Uploading… ${Math.round((progress ?? 0) * 100)}%`
            : saving
              ? "Saving…"
              : file
                ? "Upload and publish"
                : "Save description"}
        </button>
        {removeLabel && !file ? (
          <button className="staff-secondary-button" disabled={busy} onClick={handleRemove} type="button">
            <Trash2 size={17} /> {removeLabel}
          </button>
        ) : null}
      </form>
    </article>
  );
}
