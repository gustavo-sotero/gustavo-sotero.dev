import { SkillManager } from '@/components/admin/SkillManager';

export default function AdminSkillsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Skills</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Gerencie as skills técnicas exibidas no hero e no currículo
        </p>
      </div>
      <SkillManager />
    </div>
  );
}
