interface Props {
  size?: number;
  className?: string;
}

export function BrindariLogo({ size = 36, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Stem */}
      <rect x="44" y="62" width="12" height="62" rx="6" fill="#C9A84C" />

      {/* Top-left leaf */}
      <ellipse
        cx="36" cy="36"
        rx="22" ry="30"
        transform="rotate(-20 36 36)"
        fill="#C9A84C"
      />

      {/* Top-right leaf */}
      <ellipse
        cx="64" cy="36"
        rx="22" ry="30"
        transform="rotate(20 64 36)"
        fill="#D4B96A"
      />

      {/* Bottom-left leaf */}
      <ellipse
        cx="22" cy="62"
        rx="20" ry="27"
        transform="rotate(-35 22 62)"
        fill="#C9A84C"
      />

      {/* Bottom-right leaf */}
      <ellipse
        cx="78" cy="62"
        rx="20" ry="27"
        transform="rotate(35 78 62)"
        fill="#D4B96A"
      />
    </svg>
  );
}
