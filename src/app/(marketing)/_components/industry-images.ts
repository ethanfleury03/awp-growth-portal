/**
 * Path resolution for /industries trade photography.
 *
 * Mirrors `landing-images.ts`: each slot has a preferred JPG / PNG that the
 * Gemini generation script can drop into `public/industries/`, with an SVG
 * placeholder fallback that ships with the repo.
 */

import fs from 'node:fs';
import path from 'node:path';

export type IndustrySlot =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'roofing'
  | 'garage-door'
  | 'pest-control'
  | 'landscaping';

export interface IndustryImage {
  slot: IndustrySlot;
  alt: string;
  width: number;
  height: number;
  src: string;
}

const IMAGE_META: Record<
  IndustrySlot,
  { alt: string; width: number; height: number }
> = {
  plumbing: {
    alt: 'Plumber in navy uniform tightening a copper fitting under a modern kitchen sink.',
    width: 1200,
    height: 750,
  },
  electrical: {
    alt: 'Electrician in navy uniform installing a smart panel in a residential garage.',
    width: 1200,
    height: 750,
  },
  hvac: {
    alt: 'HVAC technician servicing a rooftop condenser unit on a clear morning.',
    width: 1200,
    height: 750,
  },
  roofing: {
    alt: 'Roofer inspecting asphalt shingles on a pitched residential roof.',
    width: 1200,
    height: 750,
  },
  'garage-door': {
    alt: 'Technician aligning a modern residential garage door track and spring.',
    width: 1200,
    height: 750,
  },
  'pest-control': {
    alt: 'Pest control technician with a backpack sprayer inspecting a home exterior.',
    width: 1200,
    height: 750,
  },
  landscaping: {
    alt: 'Landscaper edging a tidy suburban lawn on a warm summer morning.',
    width: 1200,
    height: 750,
  },
};

let resolvedCache: Record<IndustrySlot, string> | null = null;

function resolveAll(): Record<IndustrySlot, string> {
  if (resolvedCache) return resolvedCache;
  const publicDir = path.join(process.cwd(), 'public', 'industries');
  const out = {} as Record<IndustrySlot, string>;
  (Object.keys(IMAGE_META) as IndustrySlot[]).forEach((slot) => {
    const jpg = path.join(publicDir, `${slot}.jpg`);
    const png = path.join(publicDir, `${slot}.png`);
    try {
      if (fs.existsSync(jpg)) {
        out[slot] = `/industries/${slot}.jpg`;
        return;
      }
      if (fs.existsSync(png)) {
        out[slot] = `/industries/${slot}.png`;
        return;
      }
    } catch {
      // best-effort, fall through to SVG
    }
    out[slot] = `/industries/${slot}.svg`;
  });
  resolvedCache = out;
  return out;
}

export function getIndustryImage(slot: IndustrySlot): IndustryImage {
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
