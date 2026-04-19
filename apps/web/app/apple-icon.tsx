import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          borderRadius: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <svg width="90" height="62" viewBox="0 0 24 18" fill="none">
          <path d="M4 9L5.5 5C5.96 4.1 6.9 3.5 8 3.5H16C17.1 3.5 18.04 4.1 18.5 5L20 9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="1" y="9" width="22" height="6" rx="2" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5"/>
          <circle cx="6.5" cy="15" r="1.8" fill="white"/>
          <circle cx="17.5" cy="15" r="1.8" fill="white"/>
        </svg>
        <span style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Kharrazi</span>
      </div>
    ),
    { ...size }
  );
}
