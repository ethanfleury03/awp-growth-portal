import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background:
            'linear-gradient(180deg, #0b1422 0%, #0e1a2b 62%, #16263e 100%)',
          color: 'white',
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          WNY Automation
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>
            Run your client workflows
            <br />
            with clarity.
          </div>
          <div style={{ fontSize: 30, color: '#ffd7b8' }}>
            Automations · Leads · Reporting · Account activity
          </div>
        </div>
        <div style={{ fontSize: 24, color: '#f26a1f', fontWeight: 700 }}>
          The secure WNY Automation Portal.
        </div>
      </div>
    ),
    size,
  );
}
