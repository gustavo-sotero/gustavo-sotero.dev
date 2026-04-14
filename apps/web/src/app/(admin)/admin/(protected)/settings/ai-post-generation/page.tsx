import { AiPostGenerationSettingsPanel } from '@/components/admin/AiPostGenerationSettingsPanel';

export default function AiPostGenerationSettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Assistente de IA</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Configure os modelos OpenRouter usados para geração de tópicos e rascunhos de posts
        </p>
      </div>
      <AiPostGenerationSettingsPanel />
    </div>
  );
}
