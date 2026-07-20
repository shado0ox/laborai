import React from 'react';

/**
 * Default brand mark shown whenever a company/tenant hasn't uploaded its own logo yet.
 * Uses initials from the app's default admin ("ش.ن") on the app's navy/gold brand colors.
 * Kept as inline SVG (not an <img>) so it scales crisply at any size with no extra request.
 */
const DefaultCompanyLogo: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="إدارة العمالة">
    <defs>
      <linearGradient id="dcl-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#123a5e" />
        <stop offset="100%" stopColor="#0b2844" />
      </linearGradient>
      <linearGradient id="dcl-gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fcd34d" />
        <stop offset="100%" stopColor="#f5b400" />
      </linearGradient>
    </defs>
    <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#dcl-bg)" />
    <circle cx="256" cy="256" r="176" fill="none" stroke="url(#dcl-gold)" strokeWidth="3" strokeOpacity="0.35" />
    <text
      x="256"
      y="288"
      fontFamily="'KacstOne','Noto Sans Arabic','Tahoma',sans-serif"
      fontSize="164"
      fontWeight={800}
      textAnchor="middle"
      fill="url(#dcl-gold)"
    >
      ش.ن
    </text>
    <rect x="196" y="366" width="120" height="10" rx="5" fill="url(#dcl-gold)" fillOpacity="0.85" />
  </svg>
);

export default DefaultCompanyLogo;