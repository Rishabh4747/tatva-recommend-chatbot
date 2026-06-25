"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Leaf, CheckCircle2, XCircle, Users, Clock, Search, LogOut, Shield, MoreVertical, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  organization: string;
  requestedAt: string;
  approvedAt?: string;
}

interface ApiAdminUser {
  id: string;
  name: string;
  email: string;
  organization: string;
  requested_at: string;
  approved_at?: string | null;
}

function mapAdminUser(u: ApiAdminUser): AdminUserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    organization: u.organization,
    requestedAt: u.requested_at,
    approvedAt: u.approved_at ?? undefined,
  };
}

async function parseApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === 'string') return data.detail;
  } catch {
    // fall through
  }
  return res.statusText || 'Request failed';
}

export default function AdminPage() {
  const router = useRouter();
  const { user, role, isLoading: authLoading, isAuthenticated, logout, authFetch } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [pending, setPending] = useState<AdminUserRow[]>([]);
  const [approved, setApproved] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    } else if (!authLoading && isAuthenticated && role !== 'admin') {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, role, router]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPending = useCallback(async () => {
    const res = await authFetch('/admin/requests/pending');
    if (!res.ok) throw new Error(await parseApiError(res));
    const data = (await res.json()) as ApiAdminUser[];
    setPending(data.map(mapAdminUser));
  }, [authFetch]);

  const fetchApproved = useCallback(async () => {
    const res = await authFetch('/admin/requests/approved');
    if (!res.ok) throw new Error(await parseApiError(res));
    const data = (await res.json()) as ApiAdminUser[];
    setApproved(data.map(mapAdminUser));
  }, [authFetch]);

  const loadLists = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      await Promise.all([fetchPending(), fetchApproved()]);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load user lists.');
    } finally {
      setListLoading(false);
    }
  }, [fetchPending, fetchApproved]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && role === 'admin') {
      loadLists();
    }
  }, [authLoading, isAuthenticated, role, loadLists]);

  const handleApprove = async (row: AdminUserRow) => {
    setActionLoadingId(row.id);
    try {
      const res = await authFetch(`/admin/requests/${row.id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      showToast(data.message || `${row.name} has been approved.`);
      await fetchPending();
      await fetchApproved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Approve failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (row: AdminUserRow) => {
    setActionLoadingId(row.id);
    try {
      const res = await authFetch(`/admin/requests/${row.id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      showToast(data.message || `${row.name}'s request has been rejected.`, 'error');
      await fetchPending();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reject failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (row: AdminUserRow) => {
    setActionLoadingId(row.id);
    setActionMenuId(null);
    try {
      const res = await authFetch(`/admin/users/${row.id}/revoke`, { method: 'POST' });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      showToast(data.message || `${row.name}'s access has been revoked.`, 'error');
      await fetchApproved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Revoke failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredPending = pending.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.organization.toLowerCase().includes(search.toLowerCase())
  );

  const filteredApproved = approved.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.organization.toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading || (isAuthenticated && role === 'admin' && listLoading && pending.length === 0 && approved.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || role !== 'admin') {
    return null;
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <header className="bg-white dark:bg-[#111] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-gray-900 dark:text-white text-sm">CarbonTatva AI</span>
                <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">Admin</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 mr-1 truncate max-w-[180px]">
                  {user.email}
                </span>
              )}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-xs"
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">

          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-500" />
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage user access requests and approved accounts.</p>
          </div>

          {listError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {listError}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{pending.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Requests</p>
              </div>
            </div>
            <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{approved.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Approved Users</p>
              </div>
            </div>
          </div>

          {/* Tabs + Search */}
          <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-0 border-b border-gray-100 dark:border-gray-800">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${activeTab === 'pending' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  Pending Requests
                  {pending.length > 0 && (
                    <span className="ml-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs px-1.5 py-0.5 rounded-full font-bold">
                      {pending.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('approved')}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${activeTab === 'approved' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  Approved Users
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email, org..."
                  className="pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-emerald-400 placeholder-gray-400 dark:placeholder-gray-500 text-gray-700 dark:text-gray-200 w-64 transition-colors"
                />
              </div>
            </div>

            {/* Pending Tab */}
            {activeTab === 'pending' && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredPending.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 dark:text-gray-500">
                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{search ? 'No matching requests.' : 'No pending requests.'}</p>
                  </div>
                ) : (
                  filteredPending.map(row => (
                    <div key={row.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-sm flex-shrink-0">
                          {row.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{row.email}</p>
                        </div>
                      </div>
                      <div className="hidden md:block text-sm text-gray-600 dark:text-gray-400">
                        {row.organization}
                      </div>
                      <div className="hidden md:block text-xs text-gray-400 dark:text-gray-500">
                        {row.requestedAt}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReject(row)}
                          disabled={actionLoadingId === row.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(row)}
                          disabled={actionLoadingId === row.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Approved Tab */}
            {activeTab === 'approved' && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredApproved.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 dark:text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{search ? 'No matching users.' : 'No approved users yet.'}</p>
                  </div>
                ) : (
                  filteredApproved.map(row => (
                    <div key={row.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-sm flex-shrink-0">
                          {row.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{row.email}</p>
                        </div>
                      </div>
                      <div className="hidden md:block text-sm text-gray-600 dark:text-gray-400">
                        {row.organization}
                      </div>
                      <div className="hidden md:block">
                        <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full font-medium">
                          Approved {row.approvedAt}
                        </span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === row.id ? null : row.id)}
                          disabled={actionLoadingId === row.id}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenuId === row.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden">
                            <button
                              onClick={() => handleRevoke(row)}
                              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <UserX className="w-4 h-4" />
                              Revoke Access
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
