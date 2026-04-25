import { TagManager } from '@/components/admin/TagManager';

export default function AdminTagsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Tags de posts</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Gerencie a taxonomia do blog. Projetos e experiência usam apenas skills.
        </p>
      </div>
      <TagManager />
    </div>
  );
}
