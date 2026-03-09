import { EducationForm } from '@/components/admin/EducationForm';

export default function NewEducationPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Nova Formação</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Adicione uma nova entrada de formação acadêmica
        </p>
      </div>
      <EducationForm mode="create" />
    </div>
  );
}
