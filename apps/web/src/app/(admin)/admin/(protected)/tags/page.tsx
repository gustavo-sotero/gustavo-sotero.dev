import { TagManager } from '@/components/admin/TagManager';

export default function AdminTagsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Tags</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Gerencie as tags usadas em posts e projetos</p>
      </div>
      <TagManager />
    </div>
  );
}
