import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 108,
          background: 'linear-gradient(135deg, #0f3d35 0%, #147d6f 54%, #f26a1f 100%)',
          color: '#fffdf8',
          fontSize: 164,
          fontWeight: 900,
          letterSpacing: 0,
        }}
      >
        WNY
      </div>
    ),
    {
      width: 512,
      height: 512,
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    },
  );
}
