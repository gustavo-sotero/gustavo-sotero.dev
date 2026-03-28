'use client';

import { ImagePlus } from 'lucide-react';
import { UploadDropzone } from '@/components/admin/UploadDropzone';
import { toast } from 'sonner';

export default function AdminUploadsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Uploads</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Envie imagens para a CDN. Formatos aceitos: JPEG, PNG, WebP, GIF (máx. 5 MB)
        </p>
        <p className="text-xs text-zinc-600 mt-1 max-w-2xl">
          A confirmação do upload apenas registra o evento de otimização no outbox. O resultado final depende do relay e do worker em background.
        </p>
      </div>

      <div className="max-w-xl">
        <UploadDropzone
          onUploaded={(upload) => {
            const effectiveUrl = upload.optimizedUrl ?? upload.variants?.medium ?? upload.originalUrl;
            toast.success('Imagem enviada com sucesso', {
              description: effectiveUrl,
            });
          }}
          onInsert={(markdown) => {
            navigator.clipboard.writeText(markdown);
            toast.success('Markdown copiado para a área de transferência');
          }}
        />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ImagePlus className="h-4 w-4 text-zinc-500" />
          <p className="text-sm text-zinc-400 font-medium">Sobre os uploads</p>
        </div>
        <ul className="text-xs text-zinc-600 space-y-1 list-disc list-inside">
          <li>Imagens são processadas em background pelo worker após o upload</li>
          <li>Variantes thumbnail (400px) e medium (800px) são geradas automaticamente em WebP</li>
          <li>GIFs animados são preservados sem conversão</li>
          <li>URLs das variantes ficam disponíveis após o processamento</li>
          <li>Se o processamento falhar ou expirar no cliente, reenvie a imagem e valide os logs do worker</li>
        </ul>
      </div>
    </div>
  );
}
