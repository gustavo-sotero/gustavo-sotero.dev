import { CommentModerator } from '@/components/admin/CommentModerator';

export default function AdminCommentsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Comentários</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Modere os comentários enviados pelos visitantes
        </p>
      </div>
      <CommentModerator />
    </div>
  );
}
