'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Phone, Search, Bell, MoreVertical, Clock, CheckCircle, XCircle, Mic, MicOff, Calendar, FileText } from 'lucide-react';
import { useSetSidebarAboveUserCard } from '@/components/dashboard-shell';

interface CallLog {
  id: string;
  customer_id?: string | null;
  lead_id?: string | null;
  job_id?: string | null;
  customer_name?: string | null;
  phone_number: string;
  duration_seconds?: number | null;
  created_at: string;
  status: 'completed' | 'missed' | 'voicemail';
  recording?: boolean;
  transcript?: string | null;
  ai_summary?: string | null;
  outcome?: 'booked' | 'callback' | 'info' | 'not_interested' | null;
}



const statusColors = {
  completed: 'bg-green-100 text-green-700 border-green-200',
  missed: 'bg-red-100 text-red-700 border-red-200',
  voicemail: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const outcomeColors = {
  booked: 'bg-emerald-100 text-emerald-700',
  callback: 'bg-blue-100 text-blue-700',
  info: 'bg-gray-100 text-gray-700',
  not_interested: 'bg-red-100 text-red-700',
};

const formatDuration = (durationSeconds?: number | null) => {
  const totalSeconds = Number(durationSeconds || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatTimestamp = (createdAt: string) =>
  new Date(createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const buildServiceType = (call: CallLog) => {
  const sourceText = call.ai_summary || call.transcript || '';
  if (!sourceText) {
    return 'Phone Service Request';
  }

  return sourceText.length > 60 ? `${sourceText.slice(0, 57)}...` : sourceText;
};

export default function CallsPage() {
  const setSidebarAboveUserCard = useSetSidebarAboveUserCard();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    setSidebarAboveUserCard(
      <div className="bg-white/10 rounded-xl p-4 border border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-3 h-3 rounded-full ${aiAssistantEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
          />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        <p className="text-xs text-slate-300">
          {aiAssistantEnabled ? 'Ready for incoming calls' : 'Paused'}
        </p>
      </div>
    );
    return () => setSidebarAboveUserCard(null);
  }, [aiAssistantEnabled, setSidebarAboveUserCard]);

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/calls?limit=200');
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        setCalls(data.calls || []);
      } catch {
        setError('Failed to fetch calls');
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, []);

  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      (call.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      call.phone_number.includes(search);
    const matchesFilter = filter === 'all' || call.status === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = useMemo(
    () => ({
      totalCalls: calls.length,
      completedCalls: calls.filter((call) => call.status === 'completed').length,
      bookedCalls: calls.filter((call) => call.outcome === 'booked').length,
      transcribedCalls: calls.filter((call) => !!call.ai_summary || !!call.transcript).length,
    }),
    [calls]
  );

  const updateCall = (id: string, updates: Partial<CallLog>) => {
    setCalls((current) => current.map((call) => (call.id === id ? { ...call, ...updates } : call)));
    setSelectedCall((current) => (current && current.id === id ? { ...current, ...updates } : current));
  };

  const handleCreateLead = async () => {
    if (!selectedCall) {
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCall.customer_id,
          customer_name: selectedCall.customer_name || 'Phone Caller',
          customer_phone: selectedCall.phone_number,
          issue: buildServiceType(selectedCall),
          description: selectedCall.transcript || selectedCall.ai_summary || 'Created from call log',
          source: 'phone',
          status: 'new',
        }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      await fetch('/api/calls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedCall.id, lead_id: data.lead.id, customer_id: data.lead.customer_id }),
      });

      updateCall(selectedCall.id, { lead_id: data.lead.id, customer_id: data.lead.customer_id });
    } catch {
      setError('Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleJob = async () => {
    if (!selectedCall) {
      return;
    }

    try {
      setSaving(true);
      let customerId = selectedCall.customer_id || null;

      if (!customerId) {
        const customerRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selectedCall.customer_name || 'Phone Caller',
            phone: selectedCall.phone_number,
            notes: selectedCall.ai_summary || selectedCall.transcript || 'Created from call log',
          }),
        });
        const customerData = await customerRes.json();

        if (customerData.error) {
          setError(customerData.error);
          return;
        }

        customerId = customerData.customer.id;
      }

      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          type: buildServiceType(selectedCall),
          description: selectedCall.transcript || selectedCall.ai_summary || 'Scheduled from call log',
          status: 'scheduled',
        }),
      });
      const jobData = await jobRes.json();

      if (jobData.error) {
        setError(jobData.error);
        return;
      }

      await fetch('/api/calls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCall.id,
          customer_id: customerId,
          job_id: jobData.job.id,
          outcome: 'booked',
        }),
      });

      updateCall(selectedCall.id, { customer_id: customerId, job_id: jobData.job.id, outcome: 'booked' });
    } catch {
      setError('Failed to schedule job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
            <p className="text-gray-500 text-sm">AI-powered call management</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search calls..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm w-64 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-xl relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{loading ? '...' : stats.totalCalls}</p>
                  <p className="text-sm text-blue-600">Total Calls</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{loading ? '...' : stats.completedCalls}</p>
                  <p className="text-sm text-green-600">Completed</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{loading ? '...' : stats.bookedCalls}</p>
                  <p className="text-sm text-emerald-600">Jobs Booked</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-700">
                    {loading || stats.totalCalls === 0 ? '...' : `${Math.round((stats.transcribedCalls / stats.totalCalls) * 100)}%`}
                  </p>
                  <p className="text-sm text-purple-600">AI Transcribed</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Calls</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
              <option value="voicemail">Voicemails</option>
            </select>
          </div>
          <button
            onClick={() => setAiAssistantEnabled((current) => !current)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              aiAssistantEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {aiAssistantEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {aiAssistantEnabled ? 'AI Active' : 'AI Paused'}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Phone</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Duration</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Time</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Outcome</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">AI Summary</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Loading calls...
                    </td>
                  </tr>
                ) : filteredCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCall(call)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                          {(call.customer_name || 'C').charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{call.customer_name || 'Unknown Caller'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{call.phone_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatTimestamp(call.created_at)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[call.status]}`}>
                        {call.status === 'completed' ? 'Completed' : call.status === 'missed' ? 'Missed' : 'Voicemail'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {call.outcome ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${outcomeColors[call.outcome]}`}>
                          {call.outcome === 'booked'
                            ? 'Booked'
                            : call.outcome === 'callback'
                              ? 'Callback'
                              : call.outcome === 'info'
                                ? 'Info'
                                : 'Not Interested'}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <p className="text-sm text-gray-600 truncate">{call.ai_summary || 'No summary'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && filteredCalls.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500">No calls found</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedCall && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Call Details</h3>
              <button onClick={() => setSelectedCall(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {(selectedCall.customer_name || 'C').charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900">{selectedCall.customer_name || 'Unknown Caller'}</p>
                <p className="text-sm text-gray-500">{selectedCall.phone_number}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Duration</p>
                  <p className="font-semibold text-gray-900">{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Timestamp</p>
                  <p className="font-semibold text-gray-900">{formatTimestamp(selectedCall.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <p className="font-semibold text-gray-900 capitalize">{selectedCall.status}</p>
                </div>
                {selectedCall.outcome && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Outcome</p>
                    <p className="font-semibold text-gray-900 capitalize">{selectedCall.outcome.replace('_', ' ')}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">AI</span>
                AI Summary
              </h4>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <p className="text-sm text-purple-900">{selectedCall.ai_summary || 'No AI summary available'}</p>
              </div>
            </div>

            {selectedCall.transcript && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">T</span>
                  Transcript
                </h4>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-700">{selectedCall.transcript}</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleScheduleJob}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Calendar className="w-4 h-4" />
                {saving ? 'Working...' : 'Schedule Job'}
              </button>
              <button
                onClick={handleCreateLead}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {saving ? 'Working...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
