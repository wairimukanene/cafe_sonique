"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { ImageOff, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";

import { saveShopProduct } from "@/app/admin/shop/actions";
import type { ActionState } from "@/app/dashboard/actions";
import { DEFAULT_OPTION_LABEL } from "@/lib/shop/domain";
import { photoFile, preparePhoto } from "./prepare-photo";

type Colour = { id: string; name: string; imagePath: string | null; imageAlt: string };
type Option = { id?: string; colourId: string | null; label: string; stock: number };
type PreparedPhoto = { blob: Blob; previewUrl: string };

type ColourRow = { key: string; id?: string; name: string; imagePath: string | null; prepared: PreparedPhoto | null };
type OptionRow = { key: string; id?: string; colourKey: string; label: string; stock: number };

export type ProductFormValues = {
  id: string;
  name: string;
  description: string;
  priceKes: number;
  imagePath: string | null;
  imageAlt: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  colours: Colour[];
  options: Option[];
};

type Props = {
  product?: ProductFormValues;
  isOwner: boolean;
};

let rowKey = 0;
const nextKey = (prefix: string) => `${prefix}-${rowKey++}`;

function startingColours(product?: ProductFormValues): ColourRow[] {
  return (product?.colours ?? []).map((colour) => ({
    key: colour.id,
    id: colour.id,
    name: colour.name,
    imagePath: colour.imagePath,
    prepared: null,
  }));
}

function startingOptions(product?: ProductFormValues): OptionRow[] {
  const options = product?.options.length ? product.options : [{ colourId: null, label: DEFAULT_OPTION_LABEL, stock: 0 }];
  return options.map((option) => ({
    key: nextKey("row"),
    id: option.id,
    colourKey: option.colourId ?? "",
    label: option.label,
    stock: option.stock,
  }));
}

function releasePreviews(rows: ColourRow[]) {
  for (const row of rows) if (row.prepared) URL.revokeObjectURL(row.prepared.previewUrl);
}

export function ProductForm({ product, isOwner }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [state, setState] = useState<ActionState>({ ok: false, message: "" });
  const [saving, startSaving] = useTransition();
  const [colours, setColours] = useState(() => startingColours(product));
  const [options, setOptions] = useState(() => startingOptions(product));
  const savedSignature = JSON.stringify([product?.colours ?? [], product?.options ?? []]);
  const [syncedSignature, setSyncedSignature] = useState(savedSignature);
  if (syncedSignature !== savedSignature) {
    setSyncedSignature(savedSignature);
    setColours(startingColours(product));
    setOptions(startingOptions(product));
  }

  useEffect(() => {
    return () => {
      if (prepared) URL.revokeObjectURL(prepared.previewUrl);
    };
  }, [prepared]);

  async function readPhoto(file: File | undefined) {
    setState({ ok: false, message: "" });
    if (!file) return null;
    setPreparing(true);
    try {
      const blob = await preparePhoto(file);
      return { blob, previewUrl: URL.createObjectURL(blob) };
    } catch (error) {
      setState({
        ok: false,
        message: error instanceof Error ? error.message : "That file could not be read as a photo.",
      });
      return null;
    } finally {
      setPreparing(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setPrepared(null);
    const photo = await readPhoto(event.target.files?.[0]);
    if (!photo) event.target.value = "";
    setPrepared(photo);
  }

  async function handleColourPhoto(key: string, event: ChangeEvent<HTMLInputElement>) {
    const photo = await readPhoto(event.target.files?.[0]);
    if (!photo) event.target.value = "";
    setColours((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        if (row.prepared) URL.revokeObjectURL(row.prepared.previewUrl);
        return { ...row, prepared: photo };
      }),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("photo");
    if (prepared) formData.set("photo", photoFile(prepared.blob, "product"));
    for (const colour of colours) {
      if (colour.prepared) formData.set(`colourPhoto:${colour.key}`, photoFile(colour.prepared.blob, "colour"));
    }
    startSaving(async () => {
      const result = await saveShopProduct({ ok: false, message: "" }, formData);
      setState(result);
      if (result.ok) {
        setPrepared(null);
        if (inputRef.current) inputRef.current.value = "";
        releasePreviews(colours);
        setColours((rows) => rows.map((row) => ({ ...row, prepared: null })));
        if (!product) {
          formRef.current?.reset();
          setColours([]);
          setOptions(startingOptions());
        }
      }
    });
  }

  function updateOption(key: string, patch: Partial<OptionRow>) {
    setOptions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addColour() {
    const key = nextKey("colour");
    setColours((rows) => [...rows, { key, name: "", imagePath: null, prepared: null }]);
    setOptions((rows) => {
      if (!colours.length) return rows.map((row) => ({ ...row, colourKey: key }));
      const firstKey = colours[0].key;
      const sizes = rows.filter((row) => row.colourKey === firstKey).map((row) => row.label);
      const copies = (sizes.length ? sizes : [DEFAULT_OPTION_LABEL]).map((label) => ({
        key: nextKey("row"),
        colourKey: key,
        label,
        stock: 0,
      }));
      return [...rows, ...copies];
    });
  }

  function removeColour(key: string) {
    const removed = colours.find((row) => row.key === key);
    if (removed) releasePreviews([removed]);
    const remaining = colours.filter((row) => row.key !== key);
    setColours(remaining);
    setOptions((rows) => {
      if (!remaining.length) {
        const kept = rows.filter((row) => row.colourKey === key);
        return (kept.length ? kept : startingOptions()).map((row) => ({ ...row, colourKey: "" }));
      }
      const kept = rows.filter((row) => row.colourKey !== key);
      return kept.length ? kept : [{ key: nextKey("row"), colourKey: remaining[0].key, label: DEFAULT_OPTION_LABEL, stock: 0 }];
    });
  }

  const busy = preparing || saving;
  const previewPath = prepared?.previewUrl ?? product?.imagePath ?? null;
  const hasColours = colours.length > 0;

  return (
    <form ref={formRef} className="product-form" onSubmit={handleSubmit}>
      <div className="photo-slot-preview product-form-photo">
        {previewPath ? (
          <Image
            src={previewPath}
            alt={product?.imageAlt || "Product photo"}
            fill
            unoptimized={Boolean(prepared)}
            sizes="240px"
            className="object-cover"
          />
        ) : (
          <div className="photo-slot-empty">
            <ImageOff size={28} />
            <p>No photo yet.</p>
          </div>
        )}
        {prepared ? <span className="status-pill photo-slot-badge">New – not saved yet</span> : null}
      </div>

      <div className="dashboard-form">
        {product ? <input name="id" type="hidden" value={product.id} /> : null}
        <div className="dashboard-form-grid">
          <label>
            Product name
            <input name="name" defaultValue={product?.name} maxLength={80} required />
          </label>
          <label>
            Price in KES {isOwner ? null : <small className="normal-case text-ink/45">(owner only)</small>}
            <input
              name="priceKes"
              type="number"
              min="1"
              defaultValue={product?.priceKes}
              readOnly={!isOwner}
              required
            />
          </label>
        </div>
        <label>
          Description
          <textarea name="description" defaultValue={product?.description} maxLength={400} rows={2} required />
        </label>
        <div className="dashboard-form-grid">
          <label>
            Photo
            <input ref={inputRef} name="photo" type="file" accept="image/*" onChange={handleFileChange} disabled={busy} />
          </label>
          <label>
            Describe the photo
            <input name="imageAlt" defaultValue={product?.imageAlt} maxLength={200} placeholder="e.g. Cream Sonique mug on the bar" />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">Colours</legend>
          <p className="text-xs text-ink/50">
            {hasColours
              ? "Each colour needs a photo in that colour. Customers see it when they pick that colour."
              : "One colour only? Leave this empty."}
          </p>
          {colours.map((colour) => {
            const thumb = colour.prepared?.previewUrl ?? colour.imagePath;
            return (
              <div className="product-colour-row" key={colour.key}>
                <input name="colourKey" type="hidden" value={colour.key} />
                <input name="colourId" type="hidden" value={colour.id ?? ""} />
                <div className="product-colour-thumb">
                  {thumb ? (
                    <Image src={thumb} alt="" fill unoptimized={Boolean(colour.prepared)} sizes="56px" className="object-cover" />
                  ) : (
                    <ImageOff size={18} />
                  )}
                </div>
                <input
                  name="colourName"
                  aria-label="Colour name"
                  placeholder="e.g. White"
                  value={colour.name}
                  onChange={(event) =>
                    setColours((rows) =>
                      rows.map((row) => (row.key === colour.key ? { ...row, name: event.target.value } : row)),
                    )
                  }
                  readOnly={!isOwner}
                  maxLength={30}
                  required
                />
                <input
                  type="file"
                  accept="image/*"
                  aria-label={`Photo for ${colour.name || "this colour"}`}
                  onChange={(event) => handleColourPhoto(colour.key, event)}
                  disabled={busy || (!isOwner && !colour.id)}
                />
                {isOwner ? (
                  <button
                    type="button"
                    className="staff-secondary-button"
                    aria-label={`Remove ${colour.name || "colour"}`}
                    onClick={() => removeColour(colour.key)}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            );
          })}
          {isOwner ? (
            <button type="button" className="staff-secondary-button w-fit" onClick={addColour}>
              <Plus size={15} /> Add a colour
            </button>
          ) : null}
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">
            {hasColours ? "Colours, sizes and stock" : "Sizes and stock"}{" "}
            {isOwner ? null : <small className="normal-case">(owner only)</small>}
          </legend>
          <p className="text-xs text-ink/50">
            No sizes? Keep one row called “{DEFAULT_OPTION_LABEL}”{hasColours ? " for each colour" : ""} and set how many you
            have.
          </p>
          {options.map((option) => (
            <div className={hasColours ? "product-option-row has-colour" : "product-option-row"} key={option.key}>
              <input name="optionId" type="hidden" value={option.id ?? ""} />
              {hasColours ? (
                <select
                  name="optionColour"
                  aria-label="Colour"
                  value={option.colourKey}
                  onChange={(event) => updateOption(option.key, { colourKey: event.target.value })}
                  disabled={!isOwner}
                  required
                >
                  <option value="" disabled>
                    Colour
                  </option>
                  {colours.map((colour) => (
                    <option key={colour.key} value={colour.key}>
                      {colour.name || "New colour"}
                    </option>
                  ))}
                </select>
              ) : (
                <input name="optionColour" type="hidden" value="" />
              )}
              {hasColours && !isOwner ? <input name="optionColour" type="hidden" value={option.colourKey} /> : null}
              <input
                name="optionLabel"
                aria-label="Size"
                value={option.label}
                onChange={(event) => updateOption(option.key, { label: event.target.value })}
                readOnly={!isOwner}
                maxLength={40}
                required
              />
              <input
                name="optionStock"
                aria-label={`Stock for ${option.label || "this size"}`}
                type="number"
                min="0"
                value={option.stock}
                onChange={(event) => updateOption(option.key, { stock: Number(event.target.value) })}
                readOnly={!isOwner}
                required
              />
              {isOwner && options.length > 1 ? (
                <button
                  type="button"
                  className="staff-secondary-button"
                  aria-label={`Remove ${option.label || "size"}`}
                  onClick={() => setOptions((rows) => rows.filter((row) => row.key !== option.key))}
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          ))}
          {isOwner ? (
            <button
              type="button"
              className="staff-secondary-button w-fit"
              onClick={() =>
                setOptions((rows) => [
                  ...rows,
                  { key: nextKey("row"), colourKey: rows.at(-1)?.colourKey ?? colours[0]?.key ?? "", label: "", stock: 0 },
                ])
              }
            >
              <Plus size={15} /> Add a size
            </button>
          ) : null}
        </fieldset>

        <div className="flex flex-wrap items-end gap-6 text-sm">
          <OwnerCheckbox name="featured" label="Show on the homepage" checked={product?.featured ?? false} isOwner={isOwner} />
          <OwnerCheckbox name="active" label="On sale" checked={product?.active ?? true} isOwner={isOwner} />
          <label className="w-28">
            Display order
            <input name="sortOrder" type="number" min="0" defaultValue={product?.sortOrder ?? 0} readOnly={!isOwner} />
          </label>
        </div>

        {state.message ? (
          <p className={state.ok ? "form-success" : "form-error"} role="status">
            {state.message}
          </p>
        ) : null}
        <button className="staff-primary-button" disabled={busy} type="submit">
          {busy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
          {preparing ? "Preparing photo…" : saving ? "Saving…" : product ? "Save product" : "Add product"}
        </button>
      </div>
    </form>
  );
}

function OwnerCheckbox({
  name,
  label,
  checked,
  isOwner,
}: {
  name: string;
  label: string;
  checked: boolean;
  isOwner: boolean;
}) {
  return (
    <label className="check-field">
      {isOwner ? (
        <input className="h-4 w-4" name={name} type="checkbox" defaultChecked={checked} />
      ) : (
        <>
          <input className="h-4 w-4" type="checkbox" checked={checked} disabled readOnly />
          {checked ? <input name={name} type="hidden" value="on" /> : null}
        </>
      )}
      {label}
    </label>
  );
}
