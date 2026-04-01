import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MUI Router - One Key, All AI Models';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        color: '#f8fafc',
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: 16,
        }}
      >
        MUI Router
      </div>
      <div
        style={{
          fontSize: 36,
          color: '#94a3b8',
          marginBottom: 48,
        }}
      >
        One Key, All AI Models
      </div>
      <div
        style={{
          display: 'flex',
          gap: 32,
          fontSize: 22,
          color: '#64748b',
        }}
      >
        <span>OpenAI</span>
        <span>·</span>
        <span>Anthropic</span>
        <span>·</span>
        <span>Google</span>
      </div>
    </div>,
    { ...size },
  );
}
