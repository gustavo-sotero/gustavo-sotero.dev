import { ProjectForm } from '@/components/admin/ProjectForm';

export default function NewProjectPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Novo Projeto</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Adicione um novo projeto ao portfólio</p>
      </div>
      <ProjectForm mode="create" />
    </div>
  );
}
