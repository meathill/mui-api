interface PawIconProps {
  className?: string;
}

export function PawIcon({ className }: PawIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-label="paw" role="img">
      <ellipse cx="6" cy="9" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="10.5" cy="6" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="13.5" cy="6" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="18" cy="9" rx="1.8" ry="2.4" fill="currentColor" />
      <path
        d="M12 11c-3 0-5 2.5-5 5 0 1.8 1.5 3 3.2 3 0.8 0 1.2-.4 1.8-.4s1 .4 1.8.4c1.7 0 3.2-1.2 3.2-3 0-2.5-2-5-5-5z"
        fill="currentColor"
      />
    </svg>
  );
}
