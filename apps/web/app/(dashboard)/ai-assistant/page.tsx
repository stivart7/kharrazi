import { Metadata } from 'next';
import { AIAssistantContent } from '@/components/ai/ai-assistant-content';
import { UpgradeGate } from '@/components/shared/upgrade-gate';

export const metadata: Metadata = { title: 'Assistant IA — Kharrazi Fleet' };

export default function AIAssistantPage() {
  return (
    <UpgradeGate feature="ai_assistant">
      <AIAssistantContent />
    </UpgradeGate>
  );
}
