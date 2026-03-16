export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'pink';

export interface ThemeSettings {
  mode: ThemeMode;
  accentColor: AccentColor;
}

export const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: 'green', label: '绿色', hex: '#22c55e' },
  { value: 'blue', label: '蓝色', hex: '#3b82f6' },
  { value: 'purple', label: '紫色', hex: '#a855f7' },
  { value: 'orange', label: '橙色', hex: '#f97316' },
  { value: 'pink', label: '粉色', hex: '#ec4899' },
];
