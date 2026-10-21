import Image from "next/image";

export function BrandMark() {
  return (
    <span className="brand-lockup">
      <Image
        src="/images/sonique/logo.jpg"
        alt=""
        width={150}
        height={150}
        className="brand-logo"
      />
      <span className="brand-word">Sonique</span>
    </span>
  );
}
