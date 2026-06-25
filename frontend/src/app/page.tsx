"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Settings, Plus, MessageSquare, ChevronDown, Cpu, ChevronRight, Activity, Database, CheckCircle2, AlertCircle, Leaf, Sun, Moon, Info, PanelLeft, X, Trash2, Search, Share2, Bell, History, User, HelpCircle, FileText, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

type RetrievalMode = "auto" | "fast" | "deep" | "research";

const SUGGESTED_QUESTIONS = [
  "What methods can be used to reduce reactive power losses in an electrical system?",
  "How can I calculate the Specific Energy Consumption (SEC) of a facility?",
  "What are the recommended lux levels for general office work and precision assembly?",
  "Compare the impact of VFDs on power factor versus their impact on harmonic distortion.",
  "What is the formula for calculating boiler efficiency by the indirect method?",
  "Give me a step-by-step checklist for conducting a compressed air energy audit.",
  "Why might a boiler's efficiency be low despite using high-quality fuel?",
  "Explain the difference between synchronous condensers and capacitor banks for PFC.",
  "How do you determine the optimal sizing for a power factor correction capacitor?",
  "What are the most common sources of energy loss in industrial cooling towers?",
  "How does the blowdown rate affect boiler efficiency and water consumption?",
  "What are the advantages of using synthetic lubricants in industrial gearboxes?",
  "Explain the principle of operation of a heat recovery steam generator (HRSG)."
];

interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  expandedThoughts: Record<number, boolean>;
  timestamp: number;
}

export default function Home() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<Set<string>>(new Set());
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);
  
  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState("");
  
  // Settings State
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>("auto");
  const [showModeInfo, setShowModeInfo] = useState(false);

  // Expanded thought process state per message
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Dark Mode globally
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Update suggestions on empty state
  useEffect(() => {
    if (messages.length === 0) {
      const shuffled = [...SUGGESTED_QUESTIONS].sort(() => 0.5 - Math.random());
      setCurrentSuggestions(shuffled.slice(0, 4));
    }
  }, [messages.length, currentSessionId]);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('carbontatva_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          const latestSession = parsed[0];
          setCurrentSessionId(latestSession.id);
          setMessages(latestSession.messages || []);
          setExpandedThoughts(latestSession.expandedThoughts || {});
        }
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('carbontatva_sessions', JSON.stringify(sessions));
    } else {
      localStorage.removeItem('carbontatva_sessions');
    }
  }, [sessions]);

  // Update the current session when messages or expandedThoughts change
  // We only sync expandedThoughts here now, as messages are handled explicitly
  useEffect(() => {
    if (currentSessionId) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, expandedThoughts } 
          : s
      ));
    }
  }, [expandedThoughts]);

  const executeSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    let targetId = currentSessionId;
    let isNewSession = false;

    if (!targetId) {
      targetId = Date.now().toString();
      isNewSession = true;
      setCurrentSessionId(targetId);
      currentSessionIdRef.current = targetId;
    }
    const finalTargetId = targetId;

    const userMsg = { role: "user", content: searchQuery };
    
    // Update local view immediately for optimistic UI
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    
    setLoadingSessions(prev => {
      const next = new Set(prev);
      next.add(finalTargetId);
      return next;
    });

    if (isNewSession) {
      const fallbackTitle = searchQuery.slice(0, 30) + (searchQuery.length > 30 ? "..." : "");
      setSessions(prev => [{
        id: finalTargetId,
        title: fallbackTitle,
        messages: [userMsg],
        expandedThoughts: {},
        timestamp: Date.now()
      }, ...prev]);
      
      // Async fetch title
      setTimeout(async () => {
        try {
          const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const apiUrl = rawApiUrl.replace(/\/$/, "");
          const res = await fetch(`${apiUrl}/chat/title`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchQuery }),
          });
          if (res.ok) {
            const data = await res.json();
            setSessions(prev => prev.map(s => s.id === finalTargetId ? { ...s, title: data.title } : s));
          }
        } catch (e) {
          console.error("Failed to generate title", e);
        }
      }, 0);
    } else {
      setSessions(prev => prev.map(s => s.id === finalTargetId ? { ...s, messages: [...(s.messages || []), userMsg] } : s));
    }

    try {
      const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const apiUrl = rawApiUrl.replace(/\/$/, "");
      const payload = {
        query: userMsg.content,
        retrieval_mode: retrievalMode,
        advanced_options: {
          force_colbert: false,
          force_hyde: false,
          force_multi_query: false,
          show_chunks: false,
          show_scores: false,
          show_latency: false
        }
      };

      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("API Error");

      const data = await res.json();
      const assistantMsg = { role: "assistant", data };
      
      setSessions(prev => prev.map(s => s.id === finalTargetId ? { ...s, messages: [...(s.messages || []), assistantMsg] } : s));
      
      if (currentSessionIdRef.current === finalTargetId) {
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (error) {
      const errorMsg = { role: "assistant", error: "Failed to connect to the backend API." };
      setSessions(prev => prev.map(s => s.id === finalTargetId ? { ...s, messages: [...(s.messages || []), errorMsg] } : s));
      
      if (currentSessionIdRef.current === finalTargetId) {
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setLoadingSessions(prev => {
        const next = new Set(prev);
        next.delete(finalTargetId);
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSearch(query);
  };

  const handleNewChat = () => {
    setMessages([]);
    setExpandedThoughts({});
    setCurrentSessionId(null);
    if (window.innerWidth < 640) {
      setIsSidebarOpen(false);
    }
  };

  const switchSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages || []);
      setExpandedThoughts(session.expandedThoughts || {});
      if (window.innerWidth < 640) {
        setIsSidebarOpen(false);
      }
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      handleNewChat();
    }
  };

  const toggleThought = (idx: number) => {
    setExpandedThoughts(prev => ({...prev, [idx]: !prev[idx]}));
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  const renderExecutionPipeline = (plan: any, latency: any, idx: number) => {
    if (!plan && !latency) return null;
    const isExpanded = expandedThoughts[idx];

    return (
      <div className="mb-4 mt-2">
        <button 
          onClick={() => toggleThought(idx)}
          className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800"
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Cpu className="w-3 h-3" />
          <span>Retrieval Execution Pipeline</span>
        </button>

        {isExpanded && (
          <div className="mt-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h4 className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 font-semibold">Active Tools & Pipelines</h4>
            <div className="grid grid-cols-2 gap-2">
              {plan?.use_dense && (
                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                  <Database className="w-3 h-3 text-blue-500 dark:text-blue-400" /> Dense Semantic Search
                </div>
              )}
              {plan?.use_sparse && (
                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                  <Activity className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> Sparse Keyword Match
                </div>
              )}
              {plan?.use_colbert && (
                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 text-purple-500 dark:text-purple-400" /> ColBERT Token Scoring
                </div>
              )}
              {plan?.use_multi_query && (
                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                  <MessageSquare className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> Query Decomposition
                </div>
              )}
              {plan?.use_hyde && (
                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                  <AlertCircle className="w-3 h-3 text-orange-500 dark:text-orange-400" /> HyDE Expansion
                </div>
              )}
              {plan?.use_reranking && (
                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                  <Activity className="w-3 h-3 text-rose-500 dark:text-rose-400" /> Cross-Encoder Reranking
                </div>
              )}
            </div>

            {latency && Object.keys(latency).length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-[11px] font-mono text-gray-500 dark:text-gray-400">
                <span>Total Pipeline Latency</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{latency.total?.toFixed(0)}ms</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-[#0a0a0a] overflow-hidden text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      
      {/* Sidebar */}
      <div className={`flex flex-col bg-[#f9fafb] dark:bg-[#111111] border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-20 overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0 opacity-0 border-r-0'}`}>
        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto min-w-[256px]">
          {/* Branding */}
          <div className="flex items-center gap-3 px-1 select-none">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">CarbonTatva AI</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Emissions Intelligence</p>
            </div>
          </div>

          <button 
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors text-sm font-semibold shadow-sm text-white relative z-30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>

          {/* Sidebar Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:border-emerald-400 dark:focus:border-emerald-600 placeholder-gray-400 dark:placeholder-gray-500 text-gray-700 dark:text-gray-200 transition-colors"
            />
          </div>

          {/* Chat History */}
          <div className="flex-1 mt-2 overflow-y-auto pr-1 scrollbar-hide">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 px-2">Recent Chats</h3>
            <div className="space-y-1">
              {filteredSessions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-600 font-medium">
                  {sidebarSearch ? "No matching chats." : "No previous chats."}
                </div>
              ) : (
                filteredSessions.map(session => (
                  <div key={session.id} className="relative group">
                    <button 
                      onClick={() => switchSession(session.id)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg border transition-all cursor-pointer ${currentSessionId === session.id ? 'bg-white dark:bg-gray-900 border-emerald-200 dark:border-emerald-800/50 shadow-sm text-gray-900 dark:text-gray-100 font-semibold' : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 font-medium'}`}
                    >
                      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentSessionId === session.id ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`} />
                      <span className="truncate text-left w-full pr-6">{session.title}</span>
                    </button>
                    <button 
                      onClick={(e) => deleteSession(e, session.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 cursor-pointer"
                      title="Delete Chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1 min-w-[256px]">
          <button className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors cursor-pointer">
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors cursor-pointer">
            <HelpCircle className="w-4 h-4" />
            Help & Documentation
          </button>
        </div>
      </div>
      {/* Main Area */}
      <div className="flex-1 flex flex-col relative z-10 w-full bg-white dark:bg-[#0a0a0a]">
        {/* Top Header */}
        <header className="h-16 flex items-center px-4 sm:px-6 justify-between border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              title="Toggle Sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400" title="Search">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400" title="Share">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400" title="History">
              <History className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400" title="Notifications">
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="relative ml-1">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={user?.email}
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {user?.name?.charAt(0)?.toUpperCase() || <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                  </span>
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0a0a0a]" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-30 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide">
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full mt-16 sm:mt-24">
                <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-6 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                  <Leaf className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 text-center tracking-tight">Welcome to CarbonTatva</h2>
                <p className="text-md text-gray-500 dark:text-gray-400 max-w-md text-center font-medium leading-relaxed mb-10">
                  Your AI-powered industrial energy efficiency expert. Ask me anything about utility performance, formulas, or BEE compliance.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl px-4">
                  {currentSuggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => executeSearch(q)}
                      className="text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all duration-300 rounded-xl p-4 cursor-pointer group"
                    >
                      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        "{q}"
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-emerald-600 flex items-center justify-center shadow-sm mr-3 mt-1 flex-shrink-0">
                    <Leaf className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm' : 'bg-transparent'} rounded-2xl ${msg.role === 'user' ? 'px-5 py-3.5' : 'py-2'} text-gray-800 dark:text-gray-200`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">{msg.content}</p>
                  ) : (
                    msg.error ? (
                      <div className="flex items-center gap-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50 shadow-sm">
                        <AlertCircle className="w-5 h-5" />
                        <p className="text-sm font-semibold">{msg.error}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Execution Pipeline Display */}
                        {msg.data.debug && renderExecutionPipeline(msg.data.retrieval_plan, msg.data.debug.latency_ms, idx)}

                        {/* Answer Area */}
                        <div className="prose prose-emerald dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-[15px] prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-pre:bg-gray-50 dark:prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-800 prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 text-gray-700 dark:text-gray-300">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]} 
                            rehypePlugins={[rehypeKatex]}
                          >
                            {msg.data.answer?.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')?.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')?.replace(/\[\s*(Q_c.*?)\s*\]/g, '$$$$ $1 $$$$')}
                          </ReactMarkdown>
                        </div>
                        
                        {/* Citations Area */}
                        {msg.data.citations && msg.data.citations.length > 0 && (
                          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-800">
                            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                              <FileText className="w-3 h-3" />
                              Sources & Citations
                            </h4>
                            <div className="space-y-2">
                              {msg.data.citations.map((cit: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all duration-300 rounded-lg px-3 py-2.5 cursor-default">
                                  <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                  <span className="flex-1 text-gray-700 dark:text-gray-300 font-medium truncate">{cit.book}</span>
                                  {cit.page > 0 && <span className="text-gray-400 dark:text-gray-500 text-xs font-mono flex-shrink-0">Pg {cit.page}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}

            {loadingSessions.has(currentSessionId || "") && (
              <div className="flex items-start w-full">
                <div className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-emerald-600 flex items-center justify-center shadow-sm mr-3 mt-1 flex-shrink-0">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <div className="py-2 flex items-center gap-3">
                  <div className="flex space-x-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-150"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce delay-300"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-40 flex-shrink-0" />
          </div>
        </div>

        {/* Floating Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white dark:from-[#0a0a0a] dark:via-[#0a0a0a] to-transparent pt-10">
          <div className="max-w-3xl mx-auto relative">
            
            {/* Mode Info Popover */}
            {showModeInfo && (
              <div className="absolute bottom-[calc(100%+10px)] left-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-xl p-4 w-72 z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Retrieval Modes</h4>
                  <button onClick={() => setShowModeInfo(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
                  <p><strong className="text-emerald-600 dark:text-emerald-400">Auto:</strong> Smart routing. Balances speed and accuracy based on your query's complexity.</p>
                  <p><strong className="text-emerald-600 dark:text-emerald-400">Fast:</strong> Standard hybrid search. Best for straightforward facts and definitions.</p>
                  <p><strong className="text-emerald-600 dark:text-emerald-400">Deep:</strong> Extended search. Retrieves a larger volume of context. Best for standard questions.</p>
                  <p><strong className="text-emerald-600 dark:text-emerald-400">Research:</strong> Exhaustive. Uses Multi-Query expansion and maximum context bounds. Best for complex troubleshooting.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-700 shadow-md rounded-2xl p-2 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all duration-300">
              
              {/* Inline Dropdown for Retrieval Mode */}
              <div className="relative flex-shrink-0 flex items-center gap-1 group/mode">
                <div className="relative">
                  <select 
                    value={retrievalMode}
                    onChange={(e) => setRetrievalMode(e.target.value as RetrievalMode)}
                    className="appearance-none bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 px-3 py-2 pl-3 pr-8 rounded-lg cursor-pointer outline-none border border-gray-200 dark:border-gray-700 transition-colors h-10 shadow-sm"
                  >
                    <option value="auto">Auto</option>
                    <option value="fast">Fast</option>
                    <option value="deep">Deep</option>
                    <option value="research">Research</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none group-hover/mode:text-gray-600 dark:group-hover/mode:text-gray-300 transition-colors" />
                </div>
                <button 
                  type="button"
                  onClick={() => setShowModeInfo(!showModeInfo)}
                  className={`p-1.5 rounded-md transition-colors ${showModeInfo ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  title="Mode Info"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              <textarea
                className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border-none focus:ring-0 resize-none py-3 px-4 text-[15px]"
                placeholder="Message CarbonTatva..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loadingSessions.has(currentSessionId || "")}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={loadingSessions.has(currentSessionId || "") || !query.trim()}
                className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 flex-shrink-0 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              </button>
            </form>
            <div className="text-center mt-3">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium tracking-wide">CarbonTatva can make mistakes. Verify important engineering decisions.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
