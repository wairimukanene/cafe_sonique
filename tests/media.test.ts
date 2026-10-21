import { describe, expect, it } from "vitest";

import {
  detectImageType,
  detectVideoType,
  findPhotoSlot,
  photoSlots,
  videoSlots,
} from "../src/lib/media/slots";
import { paragraphs, siteTextDefaults, siteTextFields } from "../src/lib/site-text";

const ascii = (value: string) => [...value].map((char) => char.charCodeAt(0));

describe("site photos", () => {
  it("detects supported image types from their bytes", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(
      detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toBe("png");
    expect(
      detectImageType(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")])),
    ).toBe("webp");
  });

  it("detects supported video types from their bytes", () => {
    expect(detectVideoType(new Uint8Array([0, 0, 0, 0x20, ...ascii("ftypisom")]))).toBe("mp4");
    expect(detectVideoType(new Uint8Array([0, 0, 0, 0x14, ...ascii("ftypqt  ")]))).toBe("mov");
    expect(detectVideoType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe("webm");
    expect(detectVideoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(detectVideoType(new Uint8Array(ascii("<html>")))).toBeNull();
  });

  it("rejects files that only claim to be images", () => {
    expect(detectImageType(new Uint8Array(ascii("<svg onload=alert(1)>")))).toBeNull();
    expect(detectImageType(new Uint8Array(ascii("%PDF-1.7")))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });

  it("only accepts known homepage slots", () => {
    expect(new Set(photoSlots.map((slot) => slot.key)).size).toBe(photoSlots.length);
    expect(findPhotoSlot("hero")?.label).toBe("Main photo");
    expect(findPhotoSlot("../hero")).toBeNull();
  });

  it("gives every video a cover photo slot", () => {
    for (const slot of videoSlots) {
      expect(findPhotoSlot(slot.coverSlot)).not.toBeNull();
    }
  });
});

describe("site text", () => {
  it("has a default for every field and fits within its limit", () => {
    const defaults = siteTextDefaults();
    for (const field of siteTextFields) {
      expect(defaults[field.key]).toBe(field.defaultValue);
      expect(field.defaultValue.length).toBeLessThanOrEqual(field.maxLength);
    }
  });

  it("splits text into paragraphs on blank lines", () => {
    expect(paragraphs("First line.\n\n  Second.\n\n\n")).toEqual(["First line.", "Second."]);
    expect(paragraphs("One\nparagraph")).toEqual(["One\nparagraph"]);
    expect(paragraphs("   ")).toEqual([]);
  });
});
