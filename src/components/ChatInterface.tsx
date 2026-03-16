import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message, Conversation, ThemeMode, AccentColor } from '../types';
import { ACCENT_COLORS } from '../types';
import { chatStream } from '../api';

const STORAGE_KEY = 'yxchat_conversations';
const THEME_KEY = 'yxchat_theme';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-400 hover:text-gray-600 ml-2 shrink-0"
      title="Copy"
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

export default function ChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored ? JSON.parse(stored).mode : 'system';
    } catch {
      return 'system';
    }
  });
  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored ? JSON.parse(stored).accentColor : 'green';
    } catch {
      return 'green';
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find(c => c.id === activeId);
  const messages = activeConversation?.messages || [];

  const effectiveTheme = themeMode === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;

  console.log('effectiveTheme:', effectiveTheme, 'themeMode:', themeMode);

  useEffect(() => {
    console.log('Applying theme:', effectiveTheme);
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, JSON.stringify({ mode: themeMode, accentColor }));
  }, [themeMode, accentColor]);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else if (themeMode === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [themeMode]);

  useEffect(() => {
    const color = ACCENT_COLORS.find(c => c.value === accentColor)?.hex || '#22c55e';
    document.documentElement.style.setProperty('--accent-color', color);
  }, [accentColor]);

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: generateId(),
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
    setInput('');
    setError(null);
  };

  const switchConversation = (id: string) => {
    setActiveId(id);
    setInput('');
    setError(null);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newConversations = conversations.filter(c => c.id !== id);
    setConversations(newConversations);
    if (activeId === id) {
      setActiveId(newConversations[0]?.id || null);
    }
  };

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || isLoading) return;

    setInput('');
    setError(null);

    if (!import.meta.env.VITE_ZHIPU_API_KEY) {
      setError('请在 .env 文件中配置 VITE_ZHIPU_API_KEY');
      return;
    }

    let currentConvId = activeId;

    if (!currentConvId) {
      const newConv: Conversation = {
        id: generateId(),
        title: userMessage.slice(0, 20) + (userMessage.length > 20 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations(prev => [newConv, ...prev]);
      currentConvId = newConv.id;
      setActiveId(currentConvId);
    }

    const newUserMsg: Message = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };

    setIsLoading(true);

    setConversations(prev => prev.map(c => {
      if (c.id === currentConvId) {
        return {
          ...c,
          messages: [...c.messages, newUserMsg],
          updatedAt: Date.now(),
        };
      }
      return c;
    }));

    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setConversations(prev => prev.map(c => {
      if (c.id === currentConvId) {
        return {
          ...c,
          messages: [...c.messages, assistantMsg],
          updatedAt: Date.now(),
        };
      }
      return c;
    }));

    try {
      const currentMessages: Message[] = conversations
        .find(c => c.id === currentConvId)
        ?.messages
        .concat(newUserMsg) || [newUserMsg];

      let fullContent = '';

      for await (const chunk of chatStream(currentMessages)) {
        fullContent += chunk;
        setConversations(prev => prev.map(c => {
          if (c.id === currentConvId) {
            const newMessages = [...c.messages];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg?.role === 'assistant') {
              lastMsg.content = fullContent;
            }
            return { ...c, messages: newMessages, updatedAt: Date.now() };
          }
          return c;
        }));
      }
    } catch (err) {
      let errorMsg = 'AI 回复失败了，请稍后重试';
      if (err instanceof Error) {
        console.error('Chat error:', err.message);
        if (err.message.includes('API key')) {
          errorMsg = '请在 .env 文件中配置 VITE_ZHIPU_API_KEY';
        } else if (err.message.includes('Failed to fetch')) {
          errorMsg = '网络连接失败，请检查网络后重试';
        } else if (err.message.includes('429')) {
          errorMsg = '请求过于频繁，请稍后重试';
        } else if (err.message.includes('500') || err.message.includes('502')) {
          errorMsg = 'AI 服务暂时不可用，请稍后重试';
        } else {
          errorMsg = err.message;
        }
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-1/4 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col">
        <div className="p-3 border-b dark:border-gray-700">
          <button
            onClick={createNewConversation}
            className="w-full text-white rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            + 新对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-gray-400 text-center text-sm">
              暂无对话
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => switchConversation(conv.id)}
                className={`p-3 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  activeId === conv.id ? 'border-l-4' : ''
                }`}
                style={activeId === conv.id ? { borderLeftColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' } : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate flex-1">
                    {conv.title || '新对话'}
                  </span>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="text-gray-400 hover:text-red-500 ml-2 text-xs"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(conv.updatedAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <header className="bg-white dark:bg-gray-800 shadow-sm px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {activeConversation?.title || 'AI Assistant'}
          </h1>
          <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1">
            <button
              onClick={() => setThemeMode(effectiveTheme === 'light' ? 'dark' : 'light')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 w-6"
              title={effectiveTheme === 'light' ? '切换到深色' : '切换到浅色'}
            >
              {effectiveTheme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            {ACCENT_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setAccentColor(c.value)}
                className={`w-4 h-4 rounded-full ${accentColor === c.value ? 'ring-2 ring-offset-1' : ''}`}
                style={{ backgroundColor: c.hex }}
                title={c.label}
              />
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-gray-900">
          {!activeId || messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>开始新对话...</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm shadow-sm'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: 'var(--accent-color)' } : undefined}
                >
                  {msg.role === 'assistant' && msg.content && (
                    <div className="flex justify-end">
                      <CopyButton text={msg.content} />
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.content ? (
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          return isInline ? (
                            <code className="bg-gray-100 text-red-500 px-1 rounded text-sm" {...props}>
                              {children}
                            </code>
                          ) : (
                            <SyntaxHighlighter
                              style={oneDark}
                              language={match[1]}
                              PreTag="div"
                              className="text-sm mt-1"
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400 text-sm">思考中...</span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-2xl px-4 py-2 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 disabled:bg-gray-100 dark:disabled:bg-gray-700 max-h-32"
              style={{ '--tw-ring-color': ACCENT_COLORS.find(c => c.value === accentColor)?.hex } as React.CSSProperties}
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="text-white rounded-2xl px-4 py-2 hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
