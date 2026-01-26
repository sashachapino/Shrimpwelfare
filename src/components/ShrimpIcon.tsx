interface ShrimpIconProps {
  size?: number;
  className?: string;
}

export function ShrimpIcon({ size = 32, className }: ShrimpIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {/* Body curve */}
      <path
        d="M48 20c0 8-4 14-10 18-4 2.5-8 3-12 2s-8-4-10-8c-2-4-2-9 1-13 3-4 8-6 14-6 10 0 17 3 17 7z"
        fill="#f8a5a5"
        stroke="#e57373"
        strokeWidth="2"
      />

      {/* Tail segments */}
      <path
        d="M16 19c-3 2-5 5-6 9-1 3 0 6 2 8"
        stroke="#e57373"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 28c-4 1-7 0-9-2"
        stroke="#f8a5a5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M10 32c-3 2-6 2-8 0"
        stroke="#f8a5a5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M10 36c-2 2-5 3-7 2"
        stroke="#f8a5a5"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Segments on body */}
      <path d="M38 18c-2 8-6 14-12 16" stroke="#e57373" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
      <path d="M42 20c-2 7-5 12-10 15" stroke="#e57373" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
      <path d="M34 17c-2 7-5 12-9 14" stroke="#e57373" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>

      {/* Eye */}
      <circle cx="46" cy="18" r="4" fill="white" stroke="#e57373" strokeWidth="1.5"/>
      <circle cx="47" cy="17" r="2" fill="#333"/>
      <circle cx="47.5" cy="16" r="0.8" fill="white"/>

      {/* Antennae */}
      <path d="M48 14c4-4 8-6 12-5" stroke="#e57373" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M49 16c3-2 7-2 10 0" stroke="#e57373" strokeWidth="2" strokeLinecap="round" fill="none"/>

      {/* Little legs */}
      <path d="M36 38c0 3 1 5 2 7" stroke="#f8a5a5" strokeWidth="2" strokeLinecap="round"/>
      <path d="M32 39c-1 3-1 5 0 7" stroke="#f8a5a5" strokeWidth="2" strokeLinecap="round"/>
      <path d="M28 38c-2 2-3 5-3 7" stroke="#f8a5a5" strokeWidth="2" strokeLinecap="round"/>

      {/* Smile */}
      <path d="M42 24c-1 2-3 3-5 3" stroke="#e57373" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
