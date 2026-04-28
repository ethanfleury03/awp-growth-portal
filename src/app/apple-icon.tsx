import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
          background: 'linear-gradient(180deg, #0b1422 0%, #1f3558 100%)',
          color: '#f26a1f',
          fontSize: 110,
          fontWeight: 800,
        }}
      >
        P
      </div>
    ),
    size,
  );
}
