export function LogoMark({ className = "h-8 w-8", alt = "Veri Burada" }) {
  return (
    <img
      src="/logo-tek.webp"
      alt={alt}
      className={className}
    />
  );
}

export function LogoWide({ className = "h-8 w-auto", alt = "Veri Burada" }) {
  return (
    <img
      src="/logo-genis.webp"
      alt={alt}
      className={className}
    />
  );
}
