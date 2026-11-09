import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Stethoscope, Users } from 'lucide-react';
import { FarmerAccount } from '../types/agriculture';
import type { ConsultationDraft } from '../types/consultations';
import { FruitLogo } from './FruitLogo';

// These views contain the chat rules, image-analysis UI, and expert directory.
// Loading just the active view keeps the assistant landing page responsive on
// lower-end phones and avoids downloading unused UI.
const AiAssistantTab = lazy(() =>
  import('./AiAssistantTab').then((module) => ({ default: module.AiAssistantTab }))
);
const DiagnosisTab = lazy(() =>
  import('./DiagnosisTab').then((module) => ({ default: module.DiagnosisTab }))
);
const ExpertChatTab = lazy(() =>
  import('./ExpertChatTab').then((module) => ({ default: module.ExpertChatTab }))
);

const AssistantViewFallback = () => (
  <div className="min-h-72 rounded-3xl border border-slate-200 bg-white flex items-center justify-center text-sm font-semibold text-muted">
    Đang tải công cụ hỗ trợ…
  </div>
);

interface AssistantTabProps {
  onLogin?: () => void;
  onConsultationLogin?: (draft: ConsultationDraft) => void;
  resumeDraft?: ConsultationDraft;
  onResumeHandled?: () => void;
  currentFarmer?: FarmerAccount;
  defaultSubTab?: 'chat' | 'diagnosis' | 'experts';
}

export const AssistantTab: React.FC<AssistantTabProps> = ({
  currentFarmer, onLogin, onConsultationLogin, resumeDraft, onResumeHandled,
  defaultSubTab = 'chat',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'diagnosis' | 'experts'>(defaultSubTab);
  const [forwardedQuestion, setForwardedQuestion] = useState<string | undefined>(undefined);

  // The parent can request a specific assistant view (for example, opening
  // diagnosis directly from the overview). Keep the internal tab in sync.
  useEffect(() => {
    setActiveSubTab(defaultSubTab);
  }, [defaultSubTab]);

  const handleAskAssistant = (question: string) => {
    setForwardedQuestion(question);
    setActiveSubTab('chat');
  };

  return (
    <div className="space-y-5 pb-12 font-sans">
      {/* Sub-navigation Switcher: 3 tabs */}
      <div className="bg-white rounded-3xl p-2.5 sm:p-3 border border-slate-200/90 shadow-xs">
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeSubTab === 'chat'
                ? 'bg-action text-white shadow-md'
                : 'text-body hover:text-ink hover:bg-white/60'
            }`}
          >
            <FruitLogo fruit="lychee" className="text-sm shrink-0" />
            <span className="leading-tight text-center">Trợ lý AI</span>
          </button>

          <button
            onClick={() => setActiveSubTab('diagnosis')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeSubTab === 'diagnosis'
                ? 'bg-action text-white shadow-md'
                : 'text-body hover:text-ink hover:bg-white/60'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-tight text-center">Chẩn đoán bệnh</span>
          </button>

          <button
            onClick={() => setActiveSubTab('experts')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-semibold transition-all cursor-pointer relative ${
              activeSubTab === 'experts'
                ? 'bg-action text-white shadow-md'
                : 'text-body hover:text-ink hover:bg-white/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-tight text-center">Kết nối chuyên gia</span>

          </button>
        </div>
      </div>

      {/* Render selected sub-tab */}
      <Suspense fallback={<AssistantViewFallback />}>
        {activeSubTab === 'chat' && (
          <AiAssistantTab
            currentFarmer={currentFarmer}
            initialQuestion={forwardedQuestion}
            onGoToDiagnosis={() => setActiveSubTab('diagnosis')}
          />
        )}
        {activeSubTab === 'diagnosis' && (
          <DiagnosisTab onAskAssistant={handleAskAssistant} />
        )}
        {activeSubTab === 'experts' && (
          <ExpertChatTab currentFarmer={currentFarmer} onLogin={onLogin} onConsultationLogin={onConsultationLogin} resumeDraft={resumeDraft} onResumeHandled={onResumeHandled} />
        )}
      </Suspense>
    </div>
  );
};
