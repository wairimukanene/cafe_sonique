"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { ImageOff, ImageUp, LoaderCircle, Save, Undo2 } from "lucide-react";

import { removeSitePhoto, saveSitePhoto } from "@/app/admin/actions";
import type { ActionState } from "@/app/dashboard/actions";
import type { PhotoSlot } from "@/lib/media/slots";
import { photoFile, preparePhoto } from "./prepare-photo";

type Props = {
  slot: Pick<PhotoSlot, "key" | "label" | "placement">;
  current: { path: string | null; altText: string };
  removeLabel: string | null;
};

type PreparedPhoto = { blob: Blob; previewUrl: string };

export function PhotoSlotForm({ slot, current, removeLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [state, setState] = useState<ActionState>({ ok: false, message: "" });
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    return () => {
      if (prepared) URL.revokeObjectURL(prepared.previewUrl);
    };
  }, [prepared]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPrepared(null);
    setState({ ok: false, message: "" });
    if (!file) return;

    setPreparing(true);
    try {
      const blob = await preparePhoto(file);
      setPrepared({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch (error) {
      event.target.value = "";
      setState({
        ok: false,
        message: error instanceof Error ? error.message : "That file could not be read as a photo.",
      });
    } finally {
      setPreparing(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("photo");
    if (prepared) formData.set("photo", photoFile(prepared.blob, slot.key));

    startSaving(async () => {
      const result = await saveSitePhoto({ ok: false, message: "" }, formData);
      setState(result);
      if (result.ok) {
        setPrepared(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleRemove() {
    const formData = new FormData();
    formData.set("key", slot.key);
    startSaving(async () => {
      setState(await removeSitePhoto({ ok: false, message: "" }, formData));
    });
  }

  const busy = preparing || saving;

  return (
    <article className="dashboard-panel photo-slot">
      <div className="photo-slot-preview">
        {prepared ? (
          <Image src={prepared.previewUrl} alt="New photo preview" fill unoptimized className="object-cover" />
        ) : current.path ? (
          <Image src={current.path} alt={current.altText} fill sizes="(max-width: 900px) 100vw, 360px" className="object-cover" />
        ) : (
          <div className="photo-slot-empty">
            <ImageOff size={28} />
            <p>No photo yet. This spot shows a plain placeholder until you add one.</p>
          </div>
        )}
        {prepared ? <span className="status-pill photo-slot-badge">New – not saved yet</span> : null}
      </div>

      <form className="dashboard-form" onSubmit={handleSubmit}>
        <div>
          <h2 className="font-display text-3xl">{slot.label}</h2>
          <p className="mt-1 text-sm text-ink/55">{slot.placement}</p>
        </div>
        <input name="key" type="hidden" value={slot.key} />
        <label>
          Choose a new photo
          <input
            ref={inputRef}
            name="photo"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={busy}
          />
        </label>
        <label>
          Describe the photo (for screen readers and Google)
          <input name="altText" defaultValue={current.altText} maxLength={200} required />
        </label>
        {state.message ? (
          <p className={state.ok ? "form-success" : "form-error"} role="status">
            {state.message}
          </p>
        ) : null}
        <button className="staff-primary-button" disabled={busy || (!current.path && !prepared)} type="submit">
          {busy ? <LoaderCircle className="animate-spin" size={17} /> : prepared ? <ImageUp size={17} /> : <Save size={17} />}
          {preparing ? "Preparing photo…" : saving ? "Saving…" : prepared ? "Publish photo" : "Save description"}
        </button>
        {removeLabel && !prepared ? (
          <button className="staff-secondary-button" disabled={busy} onClick={handleRemove} type="button">
            <Undo2 size={17} /> {removeLabel}
          </button>
        ) : null}
      </form>
    </article>
  );
}
