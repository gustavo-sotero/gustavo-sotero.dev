'use client';

import type { Upload } from '@portfolio/shared';
import { CheckCircle, Copy, ImageIcon, Loader2, Upload as UploadIcon, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { useAdminUpload } from '@/hooks/use-admin-uploads';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

interface UploadDropzoneProps {
  onUploaded?: (upload: Upload) => void;
  onInsert?: (markdownUrl: string) => void;
  className?: string;
}

export function UploadDropzone({ onUploaded, onInsert, className }: UploadDropzoneProps) {
  const { state, upload, reset } = useAdminUpload();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      const result = await upload(file);
      if (result) onUploaded?.(result);
    },
    [upload, onUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  const effectiveUrl =
    state.effectiveUrl ?? state.optimizedUrl ?? state.variants?.medium ?? state.originalUrl;
  const markdownSnippet = effectiveUrl ? `![imagem](${effectiveUrl})` : null;

  const handleCopy = () => {
    if (markdownSnippet) {
      navigator.clipboard.writeText(markdownSnippet);
    }
  };

  const stageLabel: Record<string, string> = {
    presigning: 'Gerando URL assinada...',
    uploading: 'Enviando para S3...',
    confirming: 'Confirmando upload...',
    processing: 'Otimizando imagem...',
  };

  const isUploading = ['presigning', 'uploading', 'confirming', 'processing'].includes(state.stage);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      {(state.stage === 'idle' || state.stage === 'error') && (
        <div className="space-y-3">
          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed',
              'cursor-pointer transition-all duration-150 p-8 text-center',
              dragOver
                ? 'border-emerald-500/60 bg-emerald-500/5'
                : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900'
            )}
          >
            <div className="rounded-full bg-zinc-800 p-3">
              <ImageIcon size={20} className="text-zinc-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-300">
                Arraste uma imagem ou{' '}
                <span className="text-emerald-400 underline underline-offset-2">
                  clique para selecionar
                </span>
              </p>
              <p className="text-xs text-zinc-600">JPG, PNG, WebP ou GIF • Máximo 5MB</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileInput}
              className="sr-only"
            />
          </button>

          {state.stage === 'error' && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3 space-y-2">
              <p className="text-xs text-red-300">{state.error}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs border-red-800 text-red-200 hover:bg-red-950/40"
                onClick={() => {
                  reset();
                  inputRef.current?.click();
                }}
              >
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-emerald-400" />
            <span className="text-xs text-zinc-400">
              {stageLabel[state.stage] ?? 'Processando...'}
            </span>
            <span className="text-xs text-zinc-600 ml-auto font-mono">{state.progress}%</span>
          </div>
          <Progress value={state.progress} className="h-1.5 bg-zinc-800" />
        </div>
      )}

      {/* Done */}
      {state.stage === 'done' && state.originalUrl && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-xs font-medium text-emerald-300">Upload concluído</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
              onClick={reset}
            >
              <X size={11} className="mr-1" />
              Novo
            </Button>
          </div>

          {/* Thumbnail preview */}
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-zinc-700">
              <Image
                src={state.variants?.thumbnail ?? state.originalUrl}
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <code className="block text-xs text-zinc-500 truncate font-mono">{effectiveUrl}</code>
              {markdownSnippet && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs border-zinc-700 hover:bg-zinc-800"
                    onClick={handleCopy}
                  >
                    <Copy size={10} className="mr-1" />
                    Copiar Markdown
                  </Button>
                  {onInsert && (
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                      onClick={() => onInsert(markdownSnippet)}
                    >
                      <UploadIcon size={10} className="mr-1" />
                      Inserir
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {state.stage === 'done' && !state.originalUrl && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3 space-y-2">
          <p className="text-xs text-red-300">
            Confirmação concluída sem URL de arquivo. Refaça o upload.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs border-red-800 text-red-200 hover:bg-red-950/40"
            onClick={reset}
          >
            Reiniciar
          </Button>
        </div>
      )}
    </div>
  );
}
