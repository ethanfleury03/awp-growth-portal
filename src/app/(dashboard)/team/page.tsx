'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Search, Plus, Phone, Mail, Wrench, Calendar, CheckCircle, Trash2, X } from 'lucide-react';

interface Plumber {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
  jobs_today?: number | string;
  completed_this_week?: number | string;
}



const toNumber = (value: number | string | undefined) => Number(value || 0);
const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function TeamPage() {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [plumbers, setPlumbers] = useState<Plumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [newPlumber, setNewPlumber] = useState({ name: '', email: '', phone: '', role: 'Plumber' });

  useEffect(() => {
    const fetchPlumbers = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/plumbers?limit=200');
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        setPlumbers(data.plumbers || []);
      } catch {
        setError('Failed to fetch team');
      } finally {
        setLoading(false);
      }
    };

    fetchPlumbers();
  }, []);

  const filteredPlumbers = plumbers.filter((plumber) =>
    plumber.name.toLowerCase().includes(search.toLowerCase()) ||
    plumber.email.toLowerCase().includes(search.toLowerCase()) ||
    plumber.phone?.includes(search)
  );

  const stats = useMemo(
    () => ({
      totalPlumbers: plumbers.length,
      activeNow: plumbers.filter((plumber) => plumber.active).length,
      jobsToday: plumbers.reduce((sum, plumber) => sum + toNumber(plumber.jobs_today), 0),
      completedThisWeek: plumbers.reduce((sum, plumber) => sum + toNumber(plumber.completed_this_week), 0),
    }),
    [plumbers]
  );

  const handleAddPlumber = async () => {
    if (!newPlumber.name || !newPlumber.email) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/plumbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlumber),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setPlumbers((current) => [{ ...data.plumber, jobs_today: 0, completed_this_week: 0 }, ...current]);
      setNewPlumber({ name: '', email: '', phone: '', role: 'Plumber' });
      setShowAddModal(false);
    } catch {
      setError('Failed to add plumber');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (plumber: Plumber) => {
    try {
      const res = await fetch('/api/plumbers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plumber.id, active: !plumber.active }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setPlumbers((current) =>
        current.map((entry) => (entry.id === plumber.id ? { ...entry, active: data.plumber.active } : entry))
      );
    } catch {
      setError('Failed to update plumber');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plumber?')) {
      return;
    }

    try {
      const res = await fetch(`/api/plumbers?id=${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setPlumbers((current) => current.filter((plumber) => plumber.id !== id));
    } catch {
      setError('Failed to delete plumber');
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="text-gray-500 text-sm">Manage your plumbers and field workers</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm w-64 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
            >
              <Plus className="w-4 h-4" />
              Add Plumber
            </button>
          </div>
        </header>

        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 border border-blue-200">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
                <Users className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-blue-700">{loading ? '...' : stats.totalPlumbers}</p>
              <p className="text-sm text-blue-600">Total Team</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-5 border border-green-200">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30 mb-3">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-green-700">{loading ? '...' : stats.activeNow}</p>
              <p className="text-sm text-green-600">Active Now</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-5 border border-orange-200">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-3">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-orange-700">{loading ? '...' : stats.jobsToday}</p>
              <p className="text-sm text-orange-600">Jobs Today</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-5 border border-purple-200">
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 mb-3">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-purple-700">{loading ? '...' : stats.completedThisWeek}</p>
              <p className="text-sm text-purple-600">Completed This Week</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlumbers.map((plumber) => (
              <div
                key={plumber.id}
                className={`bg-white rounded-2xl border-2 p-6 transition-all hover:shadow-xl hover:-translate-y-1 ${
                  plumber.active
                    ? 'border-green-200 shadow-lg shadow-green-100'
                    : 'border-gray-100 shadow-sm opacity-75'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shadow-md ${
                      plumber.active
                        ? 'bg-gradient-to-br from-green-400 to-green-600 text-white'
                        : 'bg-gradient-to-br from-gray-300 to-gray-500 text-white'
                    }`}>
                      {getInitials(plumber.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{plumber.name}</h3>
                      <p className="text-sm text-gray-500">{plumber.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(plumber.id)}
                    className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500"
                    aria-label={`Delete ${plumber.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{plumber.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{plumber.email}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Jobs Today</span>
                    <span className="font-semibold text-gray-900">{toNumber(plumber.jobs_today)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Completed This Week</span>
                    <span className="font-semibold text-gray-900">{toNumber(plumber.completed_this_week)}</span>
                  </div>
                  <button
                    onClick={() => toggleActive(plumber)}
                    className={`w-full mt-3 px-3 py-2 rounded-full text-xs font-medium transition-colors ${
                      plumber.active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {plumber.active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all min-h-[240px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8" />
              </div>
              <p className="font-medium">Add New Plumber</p>
            </button>
          </div>

          {!loading && filteredPlumbers.length === 0 && (
            <div className="text-center py-12 text-gray-500">No team members found.</div>
          )}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add New Plumber</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={newPlumber.name}
                  onChange={(e) => setNewPlumber({ ...newPlumber, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={newPlumber.email}
                  onChange={(e) => setNewPlumber({ ...newPlumber, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="john@plumberos.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={newPlumber.phone}
                  onChange={(e) => setNewPlumber({ ...newPlumber, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={newPlumber.role}
                  onChange={(e) => setNewPlumber({ ...newPlumber, role: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Apprentice">Apprentice</option>
                  <option value="Journeyman">Journeyman</option>
                  <option value="Plumber">Plumber</option>
                  <option value="Senior Plumber">Senior Plumber</option>
                  <option value="Master Plumber">Master Plumber</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlumber}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Plumber'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
