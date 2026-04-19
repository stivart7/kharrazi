'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, Bot, User, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api/client';

// ── Types ──────────────────────────────────────
interface Message {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: Date;
}

// ── Quick suggestions ──────────────────────────
const SUGGESTIONS = [
  { label: 'Vue d\'ensemble',        icon: '📊', msg: 'kif kayn l7al' },
  { label: 'Retards',                icon: '🚨', msg: 'chkoun ma rj3ch' },
  { label: 'Retours aujourd\'hui',   icon: '⏰', msg: 'fin homa les retours d\'aujourd\'hui' },
  { label: 'Paiements en attente',   icon: '💳', msg: 'chkoun makhlass mazal' },
  { label: 'Véhicules disponibles',  icon: '🚗', msg: 'Véhicules disponibles' },
  { label: 'Maintenance proche',     icon: '🔧', msg: 'tomobilat li 9rib lihom maintenance' },
  { label: 'Revenus ce mois',        icon: '💰', msg: 'Revenus de ce mois' },
  { label: 'Top clients',            icon: '👥', msg: 'عطيني top clients' },
];

// ── API call ───────────────────────────────────
async function sendMessage({
  message,
  history,
}: {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}): Promise<{ reply: string; action: string }> {
  const res = await apiClient.post('/ai/command', { message, history });
  return res.data.data;
}

// ── Bubble renderer ────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const lines  = message.content.split('\n');

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-[#1a1d27] border border-white/10 text-blue-400'
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-[#1a1d27] border border-white/8 text-slate-200 rounded-tl-sm'
      )}>
        {lines.map((line, i) => {
          const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
          return (
            <p key={i} className={line === '' ? 'h-2' : ''}>
              {parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**'))
                  return <strong key={j} className="font-bold text-white">{part.slice(2, -2)}</strong>;
                if (part.startsWith('*') && part.endsWith('*'))
                  return <strong key={j} className="font-semibold text-white">{part.slice(1, -1)}</strong>;
                return part;
              })}
            </p>
          );
        })}

        <p className={cn(
          'text-[10px] mt-1.5 select-none',
          isUser ? 'text-blue-200/70 text-right' : 'text-slate-600'
        )}>
          {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────
export function AIAssistantContent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id:        'welcome',
      role:      'assistant',
      content:   '👋 *Mrhba!* Ana l\'assistant dyal l\'agence.\n\n*Ash kayn 3andi:*\n📊 Rapports & revenus\n🚨 Retards & retours\n🚗 Véhicules & matriculations\n👥 Clients & recherche\n🔧 Maintenance & alertes\n💳 Paiements en attente\n➕ Ajouter voitures & clients',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef         = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLTextAreaElement>(null);

  const mutation = useMutation({
    mutationFn: (payload: { message: string; history: { role: 'user' | 'assistant'; content: string }[] }) =>
      sendMessage(payload),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: data.reply, timestamp: new Date() },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: '⚠️ Une erreur s\'est produite. Veuillez réessayer.', timestamp: new Date() },
      ]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mutation.isPending]);

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || mutation.isPending) return;

    // Build history from current messages (exclude welcome, last 10 only)
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: msg, timestamp: new Date() },
    ]);
    setInput('');
    mutation.mutate({ message: msg, history });
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleReset = () => {
    setMessages([{
      id: 'welcome', role: 'assistant',
      content: '👋 *Nouvelle conversation.*\n\nComment puis-je vous aider?',
      timestamp: new Date(),
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[900px]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/20">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Assistant IA</h1>
            <p className="text-xs text-slate-500">Darija · العربية · Français · English</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            En ligne
          </span>
          <button
            onClick={handleReset}
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
            title="Nouvelle conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scroll-smooth">
        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}

        {/* Typing indicator */}
        {mutation.isPending && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a1d27] border border-white/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="bg-[#1a1d27] border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick suggestions ── */}
      {messages.length <= 3 && !mutation.isPending && (
        <div className="px-6 pb-3 flex gap-2 flex-wrap flex-shrink-0">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSend(s.msg)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div className="px-6 pb-6 flex-shrink-0">
        <div className="flex items-end gap-3 bg-[#1a1d27] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question... (Darija, Arabic, French, English)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
            disabled={mutation.isPending}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || mutation.isPending}
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
              input.trim() && !mutation.isPending
                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                : 'bg-white/5 text-slate-600 cursor-not-allowed'
            )}
          >
            {mutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-slate-700 text-center mt-2">
          Entrée pour envoyer · Shift+Entrée pour nouvelle ligne
        </p>
      </div>
    </div>
  );
}
