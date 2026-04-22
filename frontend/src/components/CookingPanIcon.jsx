export default function CookingPanIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="panBody" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ffca98" />
          <stop offset="100%" stopColor="#ff945f" />
        </linearGradient>
        <linearGradient id="panGlow" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,236,222,0.4)" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="evenodd">
        <path
          d="M44 96c0-16.6 13.4-30 30-30h23c18.8 0 34 15.2 34 34v4H52c-4.4 0-8-3.6-8-8Z"
          fill="url(#panBody)"
          stroke="#c9643d"
          strokeWidth="4"
        />
        <path
          d="M110 87h18c10.5 0 19 8.5 19 19"
          stroke="#c9643d"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <path
          d="M54 104h78"
          stroke="url(#panGlow)"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <ellipse cx="82" cy="98" rx="22" ry="9" fill="#fff3e8" opacity="0.8" />
        <path
          d="M67 63c-6-7-5-13 2-18M88 54c-6-7-5-13 2-18M108 63c-6-7-5-13 2-18"
          stroke="#d66f4b"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <circle cx="54" cy="34" r="10" fill="#fff8f2" opacity="0.8" />
        <circle cx="122" cy="38" r="7" fill="#fff1e8" opacity="0.75" />
      </g>
    </svg>
  );
}
