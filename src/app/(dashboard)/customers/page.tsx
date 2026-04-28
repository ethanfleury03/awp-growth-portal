'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, Bell, Plus, MoreHorizontal, MapPin, Phone, Mail, X, FileSpreadsheet } from 'lucide-react';

interface Customer {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Aggregated fields
  total_jobs?: number;
  total_spent?: number;
  last_job_date?: string;
}

interface CustomerStats {
  total: number;
}



export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats>({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search
  const [search, setSearch] = useState('');
  
  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  // Fetch customers from API
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setCustomers(data.customers || []);
        setStats({ total: data.total || 0 });
      }
    } catch (err) {
      setError('Failed to fetch customers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Handle search
  const handleSearch = (value: string) => {
    setSearch(value);
    fetchCustomers();
  };

  // Handle create customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      
      const data = await res.json();
      
      if (data.error) {
        alert(data.error);
      } else {
        setShowAddModal(false);
        setNewCustomer({
          name: '',
          email: '',
          phone: '',
          address: '',
          notes: '',
        });
        fetchCustomers();
      }
    } catch (err) {
      alert('Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    
    try {
      const res = await fetch(`/api/customers?id=${customerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.error) {
        fetchCustomers();
      }
    } catch (err) {
      console.error('Failed to delete customer');
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format price
  const formatPrice = (price: unknown) => {
    if (!price) return '-';
    const num = typeof price === 'string' ? parseFloat(price) : Number(price);
    return `$${num.toLocaleString()}`;
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 min-h-0 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
            <p className="text-gray-500 text-sm">Manage your customer relationships</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search customers..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm w-64 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Total Customers</p>
              <p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.total}</p>
            </div>
          </div>

          {/* Add Button */}
          <div className="flex justify-end mb-6">
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition"
            >
              <Plus className="w-5 h-5" /> Add Customer
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Customers Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Customer</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Contact</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Location</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Jobs</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Total Spent</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Last Job</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      Loading customers...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No customers found. {search && 'Try a different search.'}
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium">{customer.name.charAt(0)}</span>
                          </div>
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                          >
                            {customer.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {customer.email && (
                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                              <Mail className="w-4 h-4" />
                              {customer.email}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Phone className="w-4 h-4" />
                            {customer.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <MapPin className="w-4 h-4" />
                          {customer.address || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{customer.total_jobs || 0}</td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{formatPrice(customer.total_spent)}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{formatDate(customer.last_job_date || '')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/estimates/new?customer_id=${encodeURIComponent(customer.id)}`}
                            className="p-2 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600"
                            title="New estimate"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </Link>
                          <button 
                            onClick={() => handleDelete(customer.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Add New Customer</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Smith"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@email.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Main St, Brooklyn, NY"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}