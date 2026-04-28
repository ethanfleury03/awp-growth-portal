/**
 * Metadata + path resolution for marketing hero/feature photography.
 *
 * Each slot has a target `jpgPath` and an `svgPath` fallback. Generated photos
 * from `scripts/generate_landing_images.py` land at `jpgPath`; until that
 * script runs, the page uses the SVG placeholders that ship with the repo.
 *
 * Consumers should render with `next/image` or a plain `<img>`; swapping from
 * SVG to JPG is a zero-code step — simply drop the produced JPG into
 * `public/landing/` and redeploy.
 */

import fs from 'node:fs';
import path from 'node:path';

export type LandingImageSlot =
  | 'hero'
  | 'receptionist'
  | 'dispatch'
  | 'payments'
  | 'portal'
  | 'team';

export interface LandingImage {
  slot: LandingImageSlot;
  alt: string;
  width: number;
  height: number;
  src: string;
}

const IMAGE_META: Record<
  LandingImageSlot,
  { alt: string; width: number; height: number }
> = {
  hero: {
    alt: 'A plumber in navy workwear smiles at a smartphone beside a branded service van at golden hour.',
    width: 1600,
    height: 900,
  },
  receptionist: {
    alt: 'Close-up of a tablet on a workshop bench showing a live AI receptionist call transcript.',
    width: 1200,
    height: 900,
  },
  dispatch: {
    alt: 'Dispatcher at a desk with three monitors full of map pins and a schedule grid.',
    width: 1200,
    height: 900,
  },
  payments: {
    alt: 'Homeowner hands a phone back to a plumber after signing, both smiling in a warm kitchen.',
    width: 1000,
    height: 1000,
  },
  portal: {
    alt: 'Laptop on a kitchen island showing the WNY Automation Portal customer portal with upcoming appointments.',
    width: 1000,
    height: 1000,
  },
  team: {
    alt: 'Three plumbers of varied backgrounds laughing in front of a branded van in morning light.',
    width: 1600,
    height: 900,
  },
};

let resolvedCache: Record<LandingImageSlot, string> | null = null;
const INCOMPLETE_SLOTS = new Set<LandingImageSlot>(['receptionist']);

function resolveAll(): Record<LandingImageSlot, string> {
  if (resolvedCache) return resolvedCache;
  const publicDir = path.join(process.cwd(), 'public', 'landing');
  const out = {} as Record<LandingImageSlot, string>;
  (Object.keys(IMAGE_META) as LandingImageSlot[]).forEach((slot) => {
    if (INCOMPLETE_SLOTS.has(slot)) {
      out[slot] = `/landing/${slot}.svg`;
      return;
    }

    const jpg = path.join(publicDir, `${slot}.jpg`);
    const png = path.join(publicDir, `${slot}.png`);
    try {
      if (fs.existsSync(jpg)) {
        out[slot] = `/landing/${slot}.jpg`;
        return;
      }
      if (fs.existsSync(png)) {
        out[slot] = `/landing/${slot}.png`;
        return;
      }
    } catch {
      // filesystem access is best-effort; fall through to SVG
    }
    out[slot] = `/landing/${slot}.svg`;
  });
  resolvedCache = out;
  return out;
}

export function getLandingImage(slot: LandingImageSlot): LandingImage {
  const meta = IMAGE_META[slot];
  const resolved = resolveAll();
  return {
    slot,
    alt: meta.alt,
    width: meta.width,
    height: meta.height,
    src: resolved[slot],
  };
}
