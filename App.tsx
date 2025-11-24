import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Header } from './components/Header';
import { CodeBlock } from './components/CodeBlock';
import { Avatar } from './components/Avatars';
import { Speaker, Message, DebateTopic, McpServer } from './types';
import { getDebates, insertDebate } from './services/db';
import { MCPClient } from './services/mcpClient';

// Define window interface to include jsyaml
declare global {
  interface Window {
    jsyaml: {
      load: (str: string) => any;
    };
  }
}

import supabase from './services/supabase';

const DEFAULT_CONFIG_PLACEHOLDER = `{
  "command": "npx",
  "requestOptions": {
    "headers": {
      "Authorization": "Bearer token"
    }
  },
  "type": "sse",
  "args": ["-y", "mcp-remote", "--debug"]
}`;

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3); // 1-5
  const [isThinking, setIsThinking] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<Speaker | null>(null);
  const [debateTopics, setDebateTopics] = useState<DebateTopic[]>([]);
  const [activeTopic, setActiveTopic] = useState<DebateTopic | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [dbError, setDbError] = useState<string>('');
  const [mcpLoading, setMcpLoading] = useState(false);
  
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // MCP Server State
  const [mcpServers, setMcpServers] = useState<McpServer[]>([
    { id: 'default', name: 'Local FastMCP', url: 'http://localhost:8000', status: 'disconnected', toolsCount: 0 }
  ]);

  // Edit/Add Server State
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', url: '', configJson: '' });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load Config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('config.yaml');
        if (response.ok) {
          const yamlText = await response.text();
          if (window.jsyaml) {
            const config = window.jsyaml.load(yamlText);
            if (config && Array.isArray(config.mcpServers)) {
               const servers: McpServer[] = config.mcpServers.map((s: any, index: number) => ({
                 id: s.id || `server-${index}-${Date.now()}`,
                 name: s.name,
                 url: s.url,
                 status: 'disconnected',
                 toolsCount: 0,
                 rawConfig: s
               }));
               setMcpServers(servers);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to load config.yaml, using default state.", error);
      }
    };
    loadConfig();
  }, []);

  // Supabase auth: initialize session and listen for changes
  useEffect(() => {
    let subscription: any;
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) setIsLoggedIn(true);
      } catch (err) {
        // ignore
      }
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(!!session);
      });
      subscription = authListener?.subscription;
    };
    init();
    return () => {
      try { subscription?.unsubscribe(); } catch (e) {}
    };
  }, []);

  // Initialize DB and fetch topics
  useEffect(() => {
    const initData = async () => {
      try {
        const topics = await getDebates();
        if (topics.length > 0) {
          // Convert escaped sequences ("\\n\\t", "\\n", "\\t") into real newlines/tabs for display
          const processed = topics.map(t => ({
            ...t,
            code: typeof t.code === 'string'
              ? t.code.replace(/\\n\\t/g, '\n\t').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
              : t.code
          }));
          setDebateTopics(processed);
          setActiveTopic(processed[0]);
        }
      } catch (e) {
        console.error("Failed to load DB", e);
        setDbError("Failed to load database. Please ensure WASM is supported.");
      }
    };
    initData();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Execute a single turn of the debate
  const handleNextTurn = useCallback(() => {
    if (!activeTopic) return;
    const script = activeTopic.script;

    // Safety check to prevent out of bounds
    if (currentIndex >= script.length) {
      setIsPlaying(false);
      setCurrentSpeaker(null);
      return;
    }

    const nextMsg = script[currentIndex];
    setCurrentSpeaker(nextMsg.speaker);
    setIsThinking(true);

    // Calculate timings
    const typingTime = Math.max(1000, nextMsg.text.length * 15 * (1/speed)); 
    const interTurnDelay = 1500 * (1/speed);

    // 1. Simulate "Thinking/Typing" phase
    setTimeout(() => {
      setMessages(prev => [...prev, nextMsg]);
      setIsThinking(false);
      setCurrentIndex(prev => prev + 1);
      
      // 2. Add delay before the next turn starts
      if (currentIndex + 1 < script.length) {
         setTimeout(() => {
             setCurrentSpeaker(null); 
         }, interTurnDelay);
      } else {
         // End of conversation
         setIsPlaying(false);
         setCurrentSpeaker(null);
      }
    }, typingTime);

  }, [currentIndex, speed, activeTopic]);

  // Main Loop
  useEffect(() => {
    if (isPlaying && !isThinking && activeTopic && currentIndex < activeTopic.script.length && currentSpeaker === null) {
      handleNextTurn();
    }
  }, [isPlaying, isThinking, currentIndex, currentSpeaker, handleNextTurn, activeTopic]);

  const togglePlay = () => {
    if (!isLoggedIn) {
        setShowLoginModal(true);
        return;
    }
    setIsPlaying(!isPlaying);
  };

  const handleTopicSelect = (topic: DebateTopic) => {
    setActiveTopic(topic);
    setIsPlaying(false);
    setMessages([]);
    setCurrentIndex(0);
    setCurrentSpeaker(null);
    setIsTopicModalOpen(false);
  };

  const checkServerConnection = async (serverId: string) => {
    const server = mcpServers.find(s => s.id === serverId);
    if (!server) return;

    setMcpServers(prev => prev.map(s => s.id === serverId ? { ...s, status: 'connecting' } : s));

    try {
        const client = new MCPClient(server.url);
        const tools = await client.listTools();
        setMcpServers(prev => prev.map(s => s.id === serverId ? { ...s, status: 'connected', toolsCount: tools.length } : s));
    } catch (e) {
        setMcpServers(prev => prev.map(s => s.id === serverId ? { ...s, status: 'error' } : s));
    }
  };

  const handleFetchMcp = async () => {
    const activeServer = mcpServers.find(s => s.status === 'connected') || mcpServers[0];
    
    setMcpLoading(true);
    try {
        const client = new MCPClient(activeServer.url);
        const data = await client.getDebateTopic();
        
        // Persist the new topic to Supabase and use returned row
        try {
          const inserted = await insertDebate(data as Omit<DebateTopic, 'id'>);
          if (inserted) {
            const newTopic: DebateTopic = {
              id: inserted.id,
              title: inserted.title,
              description: inserted.description,
              code: typeof inserted.code === 'string'
                ? inserted.code.replace(/\\n\\t/g, '\n\t').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
                : inserted.code,
              script: typeof inserted.script === 'string' ? JSON.parse(inserted.script) : inserted.script || [],
              preConditions: inserted.pre_conditions || inserted.preConditions || '',
              postConditions: inserted.post_conditions || inserted.postConditions || '',
              invariants: inserted.invariants || ''
            };
            setDebateTopics(prev => [...prev, newTopic]);
            handleTopicSelect(newTopic);
          } else {
            // Fallback: use local temporary id
            const newTopic: DebateTopic = { id: Date.now(), ...data };
            setDebateTopics(prev => [...prev, newTopic]);
            handleTopicSelect(newTopic);
          }
        } catch (err) {
          const newTopic: DebateTopic = { id: Date.now(), ...data };
          setDebateTopics(prev => [...prev, newTopic]);
          handleTopicSelect(newTopic);
        }
    } catch (e: any) {
        alert("MCP Error: " + e.message + "\n\nEnsure server is running and refresh the connection.");
    } finally {
        setMcpLoading(false);
    }
  };

  const handleEditServer = (server: McpServer) => {
    setEditingServer(server);
    setEditForm({
      name: server.name,
      url: server.url,
      configJson: JSON.stringify(server.rawConfig || {}, null, 2)
    });
  };

  const handleAddServerClick = () => {
    setIsAddingServer(true);
    setEditForm({
        name: '',
        url: '',
        configJson: ''
    });
  };

  const handleRemoveServer = (e: React.MouseEvent, serverId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to remove this MCP server?")) {
        setMcpServers(prev => prev.filter(s => s.id !== serverId));
    }
  };

  const closeModal = () => {
    setEditingServer(null);
    setIsAddingServer(false);
    setEditForm({ name: '', url: '', configJson: '' });
  };

  const handleSaveServer = () => {
    let parsedConfig = {};
    if (editForm.configJson) {
        try {
          parsedConfig = JSON.parse(editForm.configJson);
        } catch (e) {
          alert("Invalid JSON configuration");
          return;
        }
    }

    if (editingServer) {
        // Update existing
        setMcpServers(prev => prev.map(s => {
          if (s.id === editingServer.id) {
            return {
              ...s,
              name: editForm.name,
              url: editForm.url,
              rawConfig: parsedConfig,
              status: 'disconnected' // Reset status on config change
            };
          }
          return s;
        }));
    } else if (isAddingServer) {
        // Create new
        const newServer: McpServer = {
            id: `server-${Date.now()}`,
            name: editForm.name,
            url: editForm.url,
            status: 'disconnected',
            toolsCount: 0,
            rawConfig: parsedConfig
        };
        setMcpServers(prev => [...prev, newServer]);
    }

    closeModal();
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (isSigningUp) {
      (async () => {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: loginForm.username,
            password: loginForm.password,
          });
          if (error) {
            setLoginError(error.message || 'Signup failed');
            return;
          }
          // Sign-up usually requires email confirmation depending on Supabase settings
          setIsSigningUp(false);
          setShowLoginModal(false);
          setLoginForm({ username: '', password: '' });
          setLoginError('');
          alert('Sign up successful. Check your email to confirm your account if required.');
        } catch (err: any) {
          setLoginError(err?.message || 'Signup failed');
        }
      })();
      return;
    }

    (async () => {
      try {
        // Treat the username field as the email for Supabase auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginForm.username,
          password: loginForm.password,
        });
        if (error) {
          setLoginError(error.message || 'Login failed');
          return;
        }
        if (data?.session) {
          setIsLoggedIn(true);
          setShowLoginModal(false);
          setLoginForm({ username: '', password: '' });
          setLoginError('');
        } else {
          setLoginError('Login succeeded but no session returned');
        }
      } catch (err: any) {
        setLoginError(err?.message || 'Login failed');
      }
    })();
  };

  if (!activeTopic && !dbError) {
    return <div className="flex h-screen items-center justify-center text-white bg-[#1A1D24]">Loading Database...</div>;
  }

  const isModalOpen = editingServer !== null || isAddingServer;

  return (
    <div className="flex flex-col h-screen bg-[#1A1D24] text-[#E0E0E0] font-display overflow-hidden relative">
      <Header 
        onOpenTopics={() => setIsTopicModalOpen(true)}
        isLoggedIn={isLoggedIn}
        onLogin={() => {
          setShowLoginModal(true);
          setLoginError('');
        }}
        onLogout={async () => {
          try { await supabase.auth.signOut(); } catch (e) {}
          setIsLoggedIn(false);
          setIsPlaying(false);
        }}
      />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#252932] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Login</h2>
                    <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
                    {loginError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">error</span>
                        {loginError}
                      </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-[#9dabb9] mb-1">{isSigningUp ? 'Email' : 'Email'}</label>
                        <input 
                            type="text" 
                            value={loginForm.username}
                            onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                            className="w-full bg-[#1A1D24] border border-white/10 rounded-lg px-3 py-2 text-[#E0E0E0] focus:ring-1 focus:ring-[#9F70FD] focus:outline-none placeholder:text-[#9dabb9]/30"
                            placeholder="Enter username"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#9dabb9] mb-1">Password</label>
                        <input 
                            type="password" 
                            value={loginForm.password}
                            onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                            className="w-full bg-[#1A1D24] border border-white/10 rounded-lg px-3 py-2 text-[#E0E0E0] focus:ring-1 focus:ring-[#9F70FD] focus:outline-none placeholder:text-[#9dabb9]/30"
                            placeholder="Enter password"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                          type="submit"
                          className="w-full py-2.5 rounded-lg bg-[#9F70FD] text-white font-bold hover:bg-[#9F70FD]/90 transition-colors mt-2 shadow-lg shadow-[#9F70FD]/20"
                      >
                          {isSigningUp ? 'Create Account' : 'Sign In'}
                      </button>
                      <button type="button" onClick={() => { setIsSigningUp(!isSigningUp); setLoginError(''); }} className="w-full py-2.5 rounded-lg bg-transparent border border-white/10 text-sm text-[#9dabb9] hover:text-white transition-colors">
                        {isSigningUp ? 'Have an account? Sign in' : "Don't have an account? Create one"}
                      </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Edit/Add Server Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-[#252932] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                 <h2 className="text-xl font-bold">{isAddingServer ? 'Add MCP Server' : 'Edit MCP Server'}</h2>
                 <button onClick={closeModal} className="text-gray-400 hover:text-white">
                   <span className="material-symbols-outlined">close</span>
                 </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#9dabb9] mb-1">Server Name</label>
                  <input 
                    type="text" 
                    value={editForm.name}
                    placeholder={isAddingServer ? "e.g. n8n-mcp-server" : ""}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-[#1A1D24] border border-white/10 rounded-lg px-3 py-2 text-[#E0E0E0] focus:ring-1 focus:ring-[#9F70FD] focus:outline-none placeholder:text-[#9dabb9]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#9dabb9] mb-1">Server URL</label>
                  <input 
                    type="text" 
                    value={editForm.url}
                    placeholder={isAddingServer ? "e.g. http://localhost:5679/mcp/..." : ""}
                    onChange={(e) => setEditForm({...editForm, url: e.target.value})}
                    className="w-full bg-[#1A1D24] border border-white/10 rounded-lg px-3 py-2 text-[#E0E0E0] focus:ring-1 focus:ring-[#9F70FD] focus:outline-none placeholder:text-[#9dabb9]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#9dabb9] mb-1">Configuration (JSON)</label>
                  <div className="text-xs text-[#9dabb9] mb-2 opacity-70">
                    Matches config.yaml structure. Edit requestOptions, headers, etc. here.
                  </div>
                  <textarea 
                    value={editForm.configJson}
                    placeholder={isAddingServer ? DEFAULT_CONFIG_PLACEHOLDER : ""}
                    onChange={(e) => setEditForm({...editForm, configJson: e.target.value})}
                    className="w-full h-48 bg-[#15171c] border border-white/10 rounded-lg p-3 text-xs font-mono text-[#E0E0E0] focus:ring-1 focus:ring-[#9F70FD] focus:outline-none resize-none placeholder:text-[#9dabb9]/30"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 bg-[#1A1D24] flex justify-end gap-3">
                 <button 
                   onClick={closeModal}
                   className="px-4 py-2 rounded-lg text-sm font-medium text-[#9dabb9] hover:text-white hover:bg-white/5 transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleSaveServer}
                   disabled={isAddingServer && (!editForm.name || !editForm.url)}
                   className="px-4 py-2 rounded-lg text-sm font-bold bg-[#9F70FD] text-white hover:bg-[#9F70FD]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isAddingServer ? 'Add Server' : 'Save Changes'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Topic Selection Modal */}
      {isTopicModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#252932] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
               <h2 className="text-xl font-bold">Select Debate Topic</h2>
               <button onClick={() => setIsTopicModalOpen(false)} className="text-gray-400 hover:text-white">
                 <span className="material-symbols-outlined">close</span>
               </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
               {debateTopics.map(topic => (
                 <button 
                   key={topic.id}
                   onClick={() => handleTopicSelect(topic)}
                   className={`w-full text-left p-4 rounded-lg border transition-all flex flex-col gap-2 ${activeTopic?.id === topic.id ? 'bg-[#9F70FD]/10 border-[#9F70FD] ring-1 ring-[#9F70FD]' : 'bg-[#1A1D24] border-white/5 hover:border-white/20'}`}
                 >
                   <div className="flex items-center justify-between">
                     <span className="font-bold text-lg">{topic.title}</span>
                     {activeTopic?.id === topic.id && <span className="material-symbols-outlined text-[#9F70FD]">check_circle</span>}
                   </div>
                   <p className="text-sm text-[#9dabb9]">{topic.description}</p>
                 </button>
               ))}
            </div>

            <div className="p-6 border-t border-white/10 bg-[#1A1D24]">
                <button 
                    onClick={handleFetchMcp}
                    disabled={mcpLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#252932] border border-dashed border-[#9F70FD]/50 text-[#9F70FD] hover:bg-[#9F70FD]/10 transition-colors font-bold disabled:opacity-50"
                >
                    {mcpLoading ? (
                        <span className="w-5 h-5 border-2 border-[#9F70FD] border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                        <span className="material-symbols-outlined">cloud_download</span>
                    )}
                    {mcpLoading ? 'Connecting to MCP Server...' : 'Fetch New Question via MCP'}
                </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-hidden relative z-0">
        
        {/* LEFT PANEL: Context & Controls */}
        <div className="flex flex-col bg-[#252932] rounded-xl shadow-lg overflow-hidden h-full border border-white/5">
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex-shrink-0">
            <h1 className="text-2xl font-black leading-tight tracking-[-0.03em]">{activeTopic?.title || 'Debate'}</h1>
            <p className="text-[#9dabb9] text-base font-normal leading-normal mt-2">
              {activeTopic?.description}
            </p>
          </div>
          
          {/* Scrollable Content */}
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            <div>
              <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-[#9dabb9]">Context Code Snippet</h3>
              {activeTopic && <CodeBlock code={activeTopic.code} />}
            </div>

            {/* Formal Analysis Section */}
            {activeTopic && (
              <div>
                <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-[#9dabb9]">Formal Analysis</h3>
                <div className="space-y-4">
                  <div className="bg-[#1A1D24] border border-white/5 rounded-lg p-4 transition-colors hover:border-white/10">
                    <h4 className="text-[#9F70FD] font-bold mb-1 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">login</span>
                      Pre-condition
                    </h4>
                    <p className="text-sm text-[#E0E0E0] leading-relaxed">{activeTopic.preConditions}</p>
                  </div>
                  <div className="bg-[#1A1D24] border border-white/5 rounded-lg p-4 transition-colors hover:border-white/10">
                    <h4 className="text-[#50E3C2] font-bold mb-1 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">logout</span>
                      Post-condition
                    </h4>
                    <p className="text-sm text-[#E0E0E0] leading-relaxed">{activeTopic.postConditions}</p>
                  </div>
                  <div className="bg-[#1A1D24] border border-white/5 rounded-lg p-4 transition-colors hover:border-white/10">
                    <h4 className="text-[#4A90E2] font-bold mb-1 text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">loop</span>
                      Invariant
                    </h4>
                    <p className="text-sm text-[#E0E0E0] leading-relaxed">{activeTopic.invariants}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold mb-4">Controls</h3>
              <div className="space-y-6">
                <button 
                  onClick={togglePlay}
                  className={`w-full flex items-center justify-center gap-2 min-w-[84px] cursor-pointer rounded-lg h-12 px-4 ${isPlaying ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-[#9F70FD] text-white hover:bg-[#9F70FD]/90'} text-base font-bold transition-all`}
                >
                  <span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span>
                  <span>{isPlaying ? 'Pause Debate' : 'Start Debate'}</span>
                </button>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-medium text-[#9dabb9]">
                    <label htmlFor="speed-control">Debate Speed</label>
                    <span>{speed}x</span>
                  </div>
                  <div className="flex items-center gap-4 text-[#9dabb9]">
                    <span className="material-symbols-outlined text-xl">tornado</span>
                    <input 
                      className="w-full h-2 bg-[#15171c] rounded-lg appearance-none cursor-pointer accent-[#9F70FD]" 
                      id="speed-control" 
                      max="5" 
                      min="1" 
                      step="0.5"
                      type="range" 
                      value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    />
                    <span className="material-symbols-outlined text-xl">rocket_launch</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MCP Interface Footer */}
          <div className="bg-[#1A1D24] border-t border-white/5 p-4 text-xs flex-shrink-0">
             <div className="flex items-center gap-3 text-[#9dabb9] mb-3">
                <span className="material-symbols-outlined text-base cursor-pointer hover:text-white">chevron_left</span>
                <span className="material-symbols-outlined text-base cursor-pointer hover:text-white">deployed_code</span>
                <span className="material-symbols-outlined text-base cursor-pointer hover:text-white">edit</span>
                <div className="px-2 py-0.5 rounded-full bg-[#3d3f43] text-[#E0E0E0] font-medium flex items-center gap-1">
                   <span className="material-symbols-outlined text-sm">grid_view</span>
                   MCP
                </div>
                <span className="ml-auto text-[#9dabb9] flex items-center gap-1 cursor-pointer hover:text-white">
                   <span className="material-symbols-outlined text-base">desktop_windows</span>
                   Local Assistant
                   <span className="material-symbols-outlined text-sm">expand_more</span>
                </span>
             </div>

             <div className="space-y-2 mb-3">
                {mcpServers.map(server => (
                   <div key={server.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                         <span className="font-bold text-[#E0E0E0]">{server.name}</span>
                         <span className="flex items-center gap-1 text-[#9dabb9]" title="Tools Available">
                            <span className="material-symbols-outlined text-sm">construction</span>
                            {server.toolsCount}
                         </span>
                         <span className="flex items-center gap-1 text-[#9dabb9]" title="Prompts">
                            <span className="material-symbols-outlined text-sm">terminal</span>
                            0
                         </span>
                         <span className="flex items-center gap-1 text-[#9dabb9]" title="Resources">
                            <span className="material-symbols-outlined text-sm">database</span>
                            0
                         </span>
                      </div>
                      <div className="flex items-center gap-2">
                         <button 
                           type="button"
                           onClick={() => handleEditServer(server)}
                           className="text-[#9dabb9] hover:text-white transition-opacity"
                         >
                            <span className="material-symbols-outlined text-sm">edit</span>
                         </button>
                         <button 
                           type="button"
                           onClick={(e) => handleRemoveServer(e, server.id)}
                           className="text-[#9dabb9] hover:text-red-500 transition-colors"
                           title="Remove Server"
                         >
                             <span className="material-symbols-outlined text-sm">delete</span>
                         </button>
                         <button onClick={() => checkServerConnection(server.id)} className={`text-[#9dabb9] hover:text-white ${server.status === 'connecting' ? 'animate-spin' : ''}`}><span className="material-symbols-outlined text-sm">refresh</span></button>
                         <span className={`w-2 h-2 rounded-full ${server.status === 'connected' ? 'bg-green-500' : server.status === 'connecting' ? 'bg-yellow-500' : server.status === 'error' ? 'bg-red-500' : 'bg-slate-500'}`}></span>
                      </div>
                   </div>
                ))}
             </div>
             
             <button 
               onClick={handleAddServerClick}
               className="w-full py-2 rounded-md bg-[#252932] border border-white/10 text-[#9dabb9] hover:text-white hover:bg-[#252932]/80 transition-colors flex items-center justify-center gap-2 font-medium"
             >
                <span className="material-symbols-outlined text-sm">add</span>
                Add MCP Servers
             </button>
          </div>
        </div>

        {/* RIGHT PANEL: Stage & Chat */}
        <div className="flex flex-col bg-[#252932] rounded-xl shadow-lg overflow-hidden h-full border border-white/5 relative">
          
          {/* Stage Area (Avatars) */}
          <div className="relative flex-none p-6 border-b border-white/5 flex justify-center items-center gap-8">
            <Avatar speaker={Speaker.Tutor} isActive={currentSpeaker === Speaker.Tutor} />
            <Avatar speaker={Speaker.Student} isActive={currentSpeaker === Speaker.Student} />
          </div>

          {/* Chat History */}
          <div ref={chatContainerRef} className="flex-1 p-6 space-y-6 overflow-y-auto scroll-smooth relative">
            {messages.length === 0 && (
               <div className="absolute inset-0 flex items-center justify-center text-[#9dabb9]/50 italic flex-col gap-2">
                  <span className="material-symbols-outlined text-4xl">forum</span>
                  <span>Press Start to begin the debate...</span>
               </div>
            )}

            {messages.map((msg) => {
              const isTutor = msg.speaker === Speaker.Tutor;
              return (
                <div key={msg.id} className={`flex items-start gap-4 max-w-xl message-enter ${isTutor ? '' : 'ml-auto justify-end'}`}>
                  {isTutor && (
                      <div className="w-8 h-8 rounded-full bg-[#4A90E2] flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-lg">T</div>
                  )}
                  
                  <div className={`flex flex-col gap-1 ${isTutor ? 'items-start' : 'items-end'}`}>
                    <p className={`text-xs font-bold ${isTutor ? 'text-[#4A90E2]' : 'text-[#50E3C2]'}`}>{msg.speaker}</p>
                    <div className={`text-base font-normal leading-relaxed rounded-2xl px-5 py-3 shadow-md ${
                      isTutor 
                        ? 'rounded-tl-none bg-[#3d3f43] text-[#E0E0E0]' 
                        : 'rounded-tr-none bg-[#50E3C2]/90 text-[#101922]'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                  
                  {!isTutor && (
                      <div className="w-8 h-8 rounded-full bg-[#50E3C2] flex items-center justify-center shrink-0 text-xs font-bold text-black shadow-lg">S</div>
                  )}
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isThinking && (
              <div className={`flex items-start gap-4 max-w-xl ${currentSpeaker === Speaker.Student ? 'ml-auto justify-end' : ''}`}>
                 <div className={`flex flex-col gap-1 ${currentSpeaker === Speaker.Student ? 'items-end' : 'items-start'}`}>
                    <p className={`text-xs font-bold ${currentSpeaker === Speaker.Tutor ? 'text-[#4A90E2]' : 'text-[#50E3C2]'}`}>
                        {currentSpeaker} is thinking...
                    </p>
                    <div className={`text-base font-normal leading-normal rounded-2xl px-4 py-3 ${
                        currentSpeaker === Speaker.Tutor 
                          ? 'rounded-tl-none bg-[#3d3f43]' 
                          : 'rounded-tr-none bg-[#50E3C2]/20'
                      }`}>
                      <div className="flex items-center gap-2 h-6">
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse"></span>
                      </div>
                    </div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/5 bg-[#252932]">
            <div className="relative">
              <input 
                className="w-full h-12 pl-4 pr-14 rounded-xl bg-[#1A1D24] border border-white/5 focus:ring-2 focus:ring-[#9F70FD] focus:border-transparent focus:outline-none transition-all text-[#E0E0E0] placeholder:text-[#9dabb9]" 
                placeholder="Add a prompt or ask a clarifying question..." 
                type="text"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-8 rounded-lg bg-[#9F70FD] text-white hover:bg-[#9F70FD]/90 transition-colors">
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}