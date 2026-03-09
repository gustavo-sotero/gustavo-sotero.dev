import { PostForm } from '@/components/admin/PostForm';

export default function NewPostPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Novo Post</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Crie um novo artigo para o blog</p>
      </div>
      <PostForm mode="create" />
    </div>
  );
}
