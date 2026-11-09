import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Lightbulb,
  RotateCcw,
  User,
  Stethoscope,
} from 'lucide-react';
import { askAi, type AiHistory } from '../services/aiClient';
import { MAX_PROMPT_LENGTH } from '../utils/aiValidation';
import { FarmerAccount } from '../types/agriculture';
import { FruitLogo } from './FruitLogo';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  model?: string;
}

interface AiAssistantTabProps {
  currentFarmer?: FarmerAccount;
  initialQuestion?: string;
  onGoToDiagnosis?: () => void;
}

export const AiAssistantTab: React.FC<AiAssistantTabProps> = ({
  currentFarmer,
  initialQuestion,
  onGoToDiagnosis,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `Kính chào ${currentFarmer ? `bác ${currentFarmer.name}` : 'bác chủ vườn'}! Tôi là Trợ lý Kỹ thuật Canh tác AI Trái ngọt Bắc Ninh. Tôi có thể hỗ trợ bác về: quy trình VietGAP, kỹ thuật hãm lộc đông cho vải thiều, điều tiết phân bón kali nuôi quả cho cam Canh & bưởi Diễn, hoặc chẩn đoán phác đồ sinh học cho sâu bệnh thực địa. Bác cần tôi hỗ trợ việc gì cho vườn đồi nhà mình hôm nay?`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const pending = useRef<AbortController | null>(null);
  const sentInitial = useRef('');
  const [error, setError] = useState('');
  useEffect(() => () => pending.current?.abort(), []);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialQuestion && sentInitial.current !== initialQuestion) {
        sentInitial.current = initialQuestion;
        void handleSend(initialQuestion);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialQuestion]);

  const samplePrompts = [
    'Cách hãm lộc đông cho cây vải thiều khi trời ấm?',
    'Công thức bón đón trái cho cam Canh vụ Tết?',
    'Phòng trừ bọ xít hại vải bằng biện pháp sinh học?',
    'Tiêu chuẩn cấp mã số vùng trồng xuất khẩu?',
  ];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || pending.current) return;
    if (text.length > MAX_PROMPT_LENGTH) { setError('Câu hỏi tối đa 3.000 ký tự.'); return; }
    const controller = new AbortController(); pending.current = controller;
    const history: AiHistory = messages.filter((m) => !['msg-welcome','welcome'].includes(m.id)).map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }));
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, sender: 'user', text, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }]);
    setInputText(''); setError(''); setIsLoading(true);
    try {
      const result = await askAi(text, history, currentFarmer, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'assistant', text: result.reply, model: result.model, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (e) {
      if (!controller.signal.aborted) { setError((e as Error).message); setInputText(text); setMessages((prev) => prev.filter((m) => m.id !== id)); }
    } finally {
      if (pending.current === controller) { pending.current = null; setIsLoading(false); }
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto flex flex-col h-[740px] font-sans">
      {/* Top Banner */}
      <div className="ui-banner rounded-3xl p-5 border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-100 text-accent flex items-center justify-center">
            <FruitLogo fruit="lychee" className="text-2xl" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="ui-section-title">
                Trợ lý kỹ thuật canh tác AI
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-accent">
                Kết nối Gemini
              </span>
            </div>
            <p className="text-xs text-inverse-muted font-medium">
              Phường Chũ, TP. Bắc Ninh · Tư vấn kỹ thuật VietGAP, phân bón & thổ nhưỡng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onGoToDiagnosis && (
            <button
              onClick={onGoToDiagnosis}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-accent font-semibold text-xs border border-emerald-200 cursor-pointer"
            >
              <Stethoscope className="w-3.5 h-3.5 text-accent" />
              <span>Chẩn đoán bệnh</span>
            </button>
          )}

          <button
            onClick={() => { pending.current?.abort(); pending.current = null; setIsLoading(false); setError(''); setInputText(''); setMessages([
                {
                  id: 'welcome',
                  sender: 'assistant',
                  text: 'Hội thoại đã được làm mới. Bác cần tư vấn kỹ thuật gì cho các lô vườn hôm nay?',
                  time: '08:00',
                },
              ]); }}
            className="p-2 rounded-xl text-white hover:bg-white/15 focus-visible:outline-white transition-colors cursor-pointer"
            title="Làm mới hội thoại"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-card overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                <FruitLogo fruit="orange" className="text-xl" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-base leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                  : 'bg-slate-50 text-ink border border-slate-200/80 shadow-2xs font-normal whitespace-pre-line'
              }`}
            >
              {msg.text}
              <span
                className={`block text-xs mt-1.5 font-medium ${
                  msg.sender === 'user' ? 'text-emerald-200 text-right' : 'text-muted'
                }`}
              >
                {msg.model && <span className="block">AI · {msg.model}</span>}{msg.time}
              </span>
            </div>

            {msg.sender === 'user' && (
              <div className="w-9 h-9 rounded-xl bg-slate-200 text-body flex items-center justify-center shrink-0 shadow-xs mt-1">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
              <FruitLogo fruit="pomelo" className="text-xl" />
            </div>
            <div className="bg-slate-50 text-muted rounded-2xl p-3.5 text-xs border border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
              <span>Kỹ sư AI đang soạn câu trả lời kỹ thuật...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-muted shrink-0 flex items-center gap-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          Gợi ý:
        </span>
        {samplePrompts.map((prompt, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSend(prompt)}
            className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-body hover:text-accent border border-slate-200 hover:border-emerald-300 shrink-0 transition-colors cursor-pointer shadow-2xs font-medium"
          >
            {prompt}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
      {/* Input Message Box */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/90 shadow-card flex items-center gap-2">
        <input
          type="text"
          aria-label="Câu hỏi cho trợ lý AI"
          maxLength={MAX_PROMPT_LENGTH}
          disabled={isLoading}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
          placeholder="Nhập câu hỏi về kỹ thuật canh tác, phân bón, sâu bệnh hại..."
          className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-transparent focus:outline-hidden text-ink font-medium"
        />

        <button
          aria-label="Gửi câu hỏi"
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isLoading}
          className="ui-button-primary p-3 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
