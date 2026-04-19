import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Car icon */}
        <svg width="100" height="70" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 11L6.5 6.5C6.96 5.61 7.9 5 9 5H15C16.1 5 17.04 5.61 17.5 6.5L19 11"
            stroke="white" strokeWidth="1.5" strokeLinecap="round"
          />
          <rect x="2" y="11" width="20" height="7" rx="2" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5"/>
          <circle cx="7" cy="18" r="2" fill="white"/>
          <circle cx="17" cy="18" r="2" fill="white"/>
          <path d="M2 14H22" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
        </svg>
        <span style={{ color: 'white', fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
          Kharrazi
        </span>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
