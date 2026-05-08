'use client';

import { useState, useEffect } from 'react';
import { Search, Bell } from 'lucide-react';
import dynamic from 'next/dynamic';

type LeafletModule = typeof import('leaflet');
// Dynamic imports for Leaflet (no SSR)
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

interface MapLead {
  id: string;
  customerName: string;
  customerPhone: string;
  location: string;
  service: string;
  status: string;
  source: string;
  date: string;
  lat?: number;
  lng?: number;
}

interface ApiLead {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  location?: string;
  issue?: string;
  status: string;
  source: string;
  created_at: string;
}

// Custom marker icons by status
const createIcon = (leaflet: LeafletModule, color: string) => {
  return leaflet.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="transform: rotate(45deg); color: white; font-size: 14px;">📍</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const statusColors: Record<string, string> = {
  new: '#3b82f6',
  new_lead: '#2563eb',
  contacted: '#0ea5e9',
  qualified: '#8b5cf6',
  planning_call_scheduled: '#7c3aed',
  site_details_needed: '#d97706',
  design_layout_discussion: '#db2777',
  estimate_needed: '#ea580c',
  quoted: '#eab308',
  proposal_sent: '#ca8a04',
  follow_up_needed: '#dc2626',
  booked: '#f97316',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  won: '#15803d',
  lost: '#6b7280',
  nurture: '#475569',
};

const statusLabels: Record<string, string> = {
  new: 'New Lead',
  new_lead: 'New Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  planning_call_scheduled: 'Planning Call Scheduled',
  site_details_needed: 'Site Details Needed',
  design_layout_discussion: 'Design / Layout Discussion',
  estimate_needed: 'Estimate Needed',
  quoted: 'Quoted',
  proposal_sent: 'Proposal Sent',
  follow_up_needed: 'Follow-Up Needed',
  booked: 'Booked',
  in_progress: 'In Progress',
  completed: 'Completed',
  won: 'Won',
  lost: 'Lost',
  nurture: 'Nurture',
};



// Cabin CRM fallback data for local map demos when the authenticated API is unavailable.
const sampleLeads: MapLead[] = [
  { id: '1', customerName: 'Robert S.', customerPhone: '(555) 123-4567', location: 'Saranac Lake, NY', service: 'Four-season cabin inquiry', status: 'new_lead', source: 'website', date: 'Feb 23', lat: 44.3295, lng: -74.1313 },
  { id: '2', customerName: 'Jennifer L.', customerPhone: '(555) 456-7890', location: 'Lake Placid, NY', service: 'Guest house planning call', status: 'qualified', source: 'referral', date: 'Feb 20', lat: 44.2795, lng: -73.9799 },
  { id: '3', customerName: 'Pine Ridge Campground', customerPhone: '(555) 345-6789', location: 'Tupper Lake, NY', service: 'Campground unit expansion', status: 'proposal_sent', source: 'outreach', date: 'Feb 21', lat: 44.2239, lng: -74.4641 },
  { id: '4', customerName: 'Sarah M.', customerPhone: '(555) 234-5678', location: 'Keene, NY', service: 'Site details needed', status: 'site_details_needed', source: 'phone', date: 'Feb 22', lat: 44.2564, lng: -73.7912 },
];

// Simple MapBounds - just return null for now
function MapBounds() {
  return null;
}

// Geocode address to coordinates
const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data.lat && data.lng) {
      return { lat: data.lat, lng: data.lng };
    }
  } catch {
    console.error('Geocode failed for:', address);
  }
  return null;
};

// Default NYC coordinates for common areas
const defaultCoords: Record<string, { lat: number; lng: number }> = {
  'saranac lake': { lat: 44.3295, lng: -74.1313 },
  'lake placid': { lat: 44.2795, lng: -73.9799 },
  'tupper lake': { lat: 44.2239, lng: -74.4641 },
  'keene': { lat: 44.2564, lng: -73.7912 },
  'adirondack': { lat: 44.1126, lng: -74.1561 },
  'upstate new york': { lat: 43.2994, lng: -74.2179 },
  'new york': { lat: 43.2994, lng: -74.2179 },
};

const getDefaultCoords = (location: string): { lat: number; lng: number } | null => {
  const loc = location.toLowerCase();
  for (const key in defaultCoords) {
    if (loc.includes(key)) {
      return defaultCoords[key];
    }
  }
  return null;
};

export default function MapPage() {
  const [leads, setLeads] = useState<MapLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<MapLead | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [leafletLib, setLeafletLib] = useState<LeafletModule | null>(null);

  // Fetch leads and geocode them
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        const data = await res.json();
        
        if (data.leads) {
          const addressCache = new Map<string, { lat: number; lng: number } | null>();

          // Geocode each unique address once, then fan the result back out.
          const geocodedLeads = await Promise.all(
            data.leads.map(async (lead: ApiLead) => {
              let lat = 40.7128; // Default to NYC
              let lng = -74.0060;
              
              // Try geocoding first
              if (lead.location) {
                let coords = addressCache.get(lead.location);
                if (coords === undefined) {
                  coords = await geocodeAddress(lead.location);
                  addressCache.set(lead.location, coords);
                }
                if (coords) {
                  lat = coords.lat;
                  lng = coords.lng;
                } else {
                  // Fall back to defaults
                  const defaultCoords = getDefaultCoords(lead.location);
                  if (defaultCoords) {
                    lat = defaultCoords.lat;
                    lng = defaultCoords.lng;
                  }
                }
              }
              
              return {
                id: lead.id,
                customerName: lead.customer_name || 'Unknown',
                customerPhone: lead.customer_phone || '(555) 000-0000',
                location: lead.location || 'Unknown',
                service: lead.issue || 'Service',
                status: lead.status,
                source: lead.source,
                date: new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                lat,
                lng,
              };
            })
          );
          setLeads(geocodedLeads);
        }
      } catch (err) {
        console.error('Failed to fetch leads:', err);
        setLeads(sampleLeads);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  useEffect(() => {
    setIsClient(true);

    import('leaflet').then((leaflet) => {
      setLeafletLib(leaflet);
      delete (leaflet.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
    });
  }, []);

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.customerName.toLowerCase().includes(search.toLowerCase()) ||
      lead.service.toLowerCase().includes(search.toLowerCase()) ||
      lead.location.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new' || l.status === 'new_lead').length,
    inProgress: leads.filter(l => ['contacted', 'qualified', 'planning_call_scheduled', 'site_details_needed', 'design_layout_discussion', 'estimate_needed', 'booked', 'in_progress'].includes(l.status)).length,
    completed: leads.filter(l => l.status === 'completed' || l.status === 'won').length,
  };

  // Adirondack region center
  const center: [number, number] = [44.2795, -74.1313];

  if (!isClient) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-0 bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Map</h1>
            <p className="text-gray-500 text-sm">Visualize cabin opportunities and site locations</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search locations..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
              />
            </div>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="new_lead">New Lead</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="proposal_sent">Proposal Sent</option>
              <option value="follow_up_needed">Follow-Up Needed</option>
              <option value="won">Won</option>
            </select>
            <button className="p-2 hover:bg-gray-100 rounded-xl relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Stats Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-3">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium text-gray-700">{stats.new} New</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-sm font-medium text-gray-700">{stats.inProgress} In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-700">{stats.completed} Completed</span>
            </div>
            <div className="flex-1"></div>
            <span className="text-sm text-gray-500">{filteredLeads.length} locations shown</span>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-x-0 top-0 z-[1000] bg-white/90 px-4 py-2 text-center text-sm font-medium text-gray-600 shadow-sm">
              Loading cabin locations...
            </div>
          ) : null}
          <MapContainer 
            center={center} 
            zoom={11} 
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBounds />
            
            {filteredLeads.map(lead => (
              <Marker 
                key={lead.id} 
                position={[lead.lat!, lead.lng!]}
                icon={leafletLib ? createIcon(leafletLib, statusColors[lead.status] || '#6b7280') : undefined}
              >
                <Popup>
                  <div className="min-w-[200px] p-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: statusColors[lead.status] }}
                      >
                        {statusLabels[lead.status]}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">{lead.customerName}</h3>
                    <p className="text-sm text-blue-600 font-medium mb-2">{lead.service}</p>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <span>Phone</span>
                        <span>{lead.customerPhone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Site</span>
                        <span>{lead.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        <span>{lead.date}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-6 left-6 z-[1000] bg-white rounded-2xl shadow-xl border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Legend</h4>
            <div className="space-y-2">
              {Object.entries(statusColors).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="text-xs text-gray-600">{statusLabels[status]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lead List Sidebar */}
          <div className="absolute top-4 right-4 bottom-4 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-[1000] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Locations</h3>
              <p className="text-sm text-gray-500">{filteredLeads.length} locations</p>
            </div>
            <div className="flex-1 overflow-auto">
              {filteredLeads.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedLead?.id === lead.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: statusColors[lead.status] }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{lead.customerName}</h4>
                      <p className="text-sm text-blue-600 truncate">{lead.service}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>Site</span>
                        <span className="truncate">{lead.location}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
