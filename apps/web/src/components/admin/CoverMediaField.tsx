'use client';

import type { Upload } from '@portfolio/shared';
import { CheckCircle, ImageIcon, Link2, Loader2, Pencil, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { useAdminUpload } from '@/hooks/use-admin-uploads';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';

interface CoverMediaFieldProps {
  /** Controlled URL value from react-hook-form */
  value: string;
  /** Called whenever the URL changes (upload or manual entry) */
  onChange: (url: string) => void;
  label?: string;
  error?: string;
  /** Optional additional className on the root element */
  className?: string;
}

const stageLabel: Record<string, string> = {
  presigning: 'Gerando URL assinada...',
  uploading: 'Enviando para S3...',
  confirming: 'Confirmando upload...',
  processing: 'Otimizando imagem...',
};

function resolveEffectiveUrl(upload: Upload): string {
  return upload.optimizedUrl ?? upload.variants?.medium ?? upload.originalUrl;
}

/**
 * Unified "cover / logo" field — single visual block combining:
 *  - Image preview when a URL is already set
 *  - Drag-and-drop / file upload when empty
 *  - Optional manual URL entry via a small toggle
 *
 * Replaces the previous dual pattern of `<Input coverUrl>` + `<UploadDropzone>`.
 */
export function CoverMediaField({
  value,
  onChange,
  label = 'Capa',
  error,
  className,
}: CoverMediaFieldProps) {
  const { state, upload, reset } = useAdminUpload();
  const [dragOver, setDragOver] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isUploading = ['presigning', 'uploading', 'confirming', 'processing'].includes(state.stage);
  const hasPreview = Boolean(value);

  const processFile = useCallback(
    async (file: File) => {
      const result = await upload(file);
      if (result) {
        onChange(resolveEffectiveUrl(result));
      }
    },
    [upload, onChange]
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
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [processFile]
  );

  const handleRemove = () => {
    onChange('');
    reset();
    setShowManualUrl(false);
    setManualInput('');
  };

  const handleManualConfirm = () => {
    const trimmed = manualInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setShowManualUrl(false);
      setManualInput('');
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-zinc-300 text-sm">{label}</Label>}

      {/* ── Preview state (URL already set) ── */}
      {hasPreview && !isUploading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
          <div className="flex items-start gap-3">
            {/* Thumbnail */}
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-800">
              <Image src={value} alt="Preview" fill className="object-cover" unoptimized />
            </div>

            {/* URL + actions */}
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-zinc-500 font-mono truncate">{value}</p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 gap-1"
                  onClick={() => inputRef.current?.click()}
                >
                  <Pencil size={10} />
                  Trocar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 gap-1"
                  onClick={handleRemove}
                >
                  <Trash2 size={10} />
                  Remover
                </Button>
              </div>
            </div>
          </div>

          {/* Hidden file input for "Trocar" */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileInput}
            className="sr-only"
          />
        </div>
      )}

      {/* ── Upload in progress ── */}
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

      {/* ── Empty / error state — show dropzone ── */}
      {!hasPreview && !isUploading && (
        <>
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
              'w-full flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed',
              'cursor-pointer transition-all duration-150 p-6 text-center',
              dragOver
                ? 'border-emerald-500/60 bg-emerald-500/5'
                : state.stage === 'error'
                  ? 'border-red-800 bg-red-950/20 hover:border-red-700'
                  : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900'
            )}
          >
            {state.stage === 'done' && !hasPreview ? (
              <CheckCircle size={18} className="text-emerald-400" />
            ) : (
              <div className="rounded-full bg-zinc-800 p-2.5">
                <ImageIcon size={16} className="text-zinc-400" />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-300">
                Arraste ou{' '}
                <span className="text-emerald-400 underline underline-offset-2">
                  clique para selecionar
                </span>
              </p>
              <p className="text-xs text-zinc-600">JPG, PNG, WebP, GIF · máx. 5 MB</p>
            </div>

            {state.stage === 'error' && (
              <p className="text-xs text-red-400 bg-red-950/30 px-3 py-1.5 rounded border border-red-900/50">
                {state.error}
              </p>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileInput}
              className="sr-only"
            />
          </button>

          {/* Manual URL toggle */}
          {!showManualUrl ? (
            <button
              type="button"
              onClick={() => setShowManualUrl(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Link2 size={11} />
              Ou use uma URL externa
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <Input
                autoFocus
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualConfirm();
                  }
                  if (e.key === 'Escape') {
                    setShowManualUrl(false);
                    setManualInput('');
                  }
                }}
                placeholder="https://..."
                className="h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 text-xs bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shrink-0"
                onClick={handleManualConfirm}
              >
                OK
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-300 shrink-0"
                onClick={() => {
                  setShowManualUrl(false);
                  setManualInput('');
                }}
              >
                <X size={12} />
              </Button>
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
