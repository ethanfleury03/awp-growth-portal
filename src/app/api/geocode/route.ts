import { NextResponse } from 'next/server';

type CachedResult = { lat: number; lng: number; display_name: string };

const geocodeCache = new Map<string, CachedResult | null>();

// GET - Geocode an address to lat/lng
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim();

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  const cacheKey = address.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    return NextResponse.json({ error: 'Address not found' }, { status: 404 });
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', address);
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '0');

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'WNY Automation Portal/1.0 (local dev geocoding)',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn('Geocoding upstream error:', response.status, body.slice(0, 160));
      if (response.status === 404) {
        geocodeCache.set(cacheKey, null);
        return NextResponse.json({ error: 'Address not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Geocoding temporarily unavailable' }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('json')) {
      const body = await response.text();
      console.warn('Geocoding returned non-JSON response:', contentType, body.slice(0, 160));
      return NextResponse.json({ error: 'Geocoding temporarily unavailable' }, { status: 502 });
    }

    const data = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name,
      };
      geocodeCache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    geocodeCache.set(cacheKey, null);
    return NextResponse.json({ error: 'Address not found' }, { status: 404 });
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 });
  }
}
