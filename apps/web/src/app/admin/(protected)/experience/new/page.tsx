import { ExperienceForm } from '@/components/admin/ExperienceForm';

export default function NewExperiencePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Nova Experiência</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Adicione uma nova entrada de experiência profissional
        </p>
      </div>
      <ExperienceForm mode="create" />
    </div>
  );
}
