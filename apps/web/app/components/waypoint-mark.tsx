export function WaypointMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 30.5 19.6 9l13.7 21.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <path
        d="M12.2 27.5h15.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity=".46"
        strokeWidth="2"
      />
      <circle cx="19.6" cy="9" fill="var(--color-accent)" r="3.8" />
    </svg>
  );
}
