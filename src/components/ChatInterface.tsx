import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message, Conversation } from '../types';
import { chatStream } from '../api';

const STORAGE_KEY = 'yxchat_conversations';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find(c => c.id === activeId);
  const messages = useMemo(() => activeConversation?.messages || [], [activeConversation]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="flex h-screen bg-gray-100">
      <div className="w-1/4 bg-white border-r flex flex-col">
        <div className="p-3 border-b">
          <button
            onClick={createNewConversation}
            className="w-full bg-green-500 text-white rounded-lg px-4 py-2 hover:bg-green-600 transition-colors"
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
                className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                  activeId === conv.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate flex-1">
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
        <header className="bg-white shadow-sm px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-800">
            {activeConversation?.title || 'AI Assistant'}
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                      ? 'bg-green-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                  }`}
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
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm flex items-center gap-2">
                <span className="text-gray-500 text-sm">思考中...</span>
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

        <div className="bg-white border-t p-4">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="flex-1 resize-none border border-gray-300 rounded-2xl px-4 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 max-h-32"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-green-500 text-white rounded-2xl px-4 py-2 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
