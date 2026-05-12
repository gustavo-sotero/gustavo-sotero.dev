import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import { ImageResponse } from 'next/og';
import { SITE_METADATA } from '@/lib/constants';

export const runtime = 'edge';
export const alt = `${DEVELOPER_PUBLIC_PROFILE.name} — ${DEVELOPER_PUBLIC_PROFILE.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '64px 80px',
        backgroundColor: '#09090b',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Glow accent */}
      <div
        style={{
          position: 'absolute',
          top: '-100px',
          left: '200px',
          width: '500px',
          height: '500px',
          borderRadius: '9999px',
          background: 'radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Status pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '9999px',
            backgroundColor: '#34d399',
          }}
        />
        <span style={{ fontSize: '16px', color: '#34d399', fontFamily: 'monospace' }}>
          {DEVELOPER_PUBLIC_PROFILE.availability}
        </span>
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: '72px',
          fontWeight: 700,
          color: '#f4f4f5',
          lineHeight: 1.1,
          marginBottom: '12px',
        }}
      >
        {DEVELOPER_PUBLIC_PROFILE.name}
      </div>

      {/* Role */}
      <div
        style={{
          fontSize: '32px',
          fontWeight: 600,
          color: '#34d399',
          marginBottom: '24px',
        }}
      >
        {DEVELOPER_PUBLIC_PROFILE.role}
      </div>

      {/* Bio short */}
      <div
        style={{
          fontSize: '20px',
          color: '#a1a1aa',
          maxWidth: '800px',
          lineHeight: 1.5,
        }}
      >
        {DEVELOPER_PUBLIC_PROFILE.bioShort}
      </div>

      {/* Domain */}
      <div
        style={{
          position: 'absolute',
          bottom: '48px',
          right: '80px',
          fontSize: '16px',
          color: '#52525b',
          fontFamily: 'monospace',
        }}
      >
        {SITE_METADATA.url.replace('https://', '')}
      </div>
    </div>,
    { ...size }
  );
}
