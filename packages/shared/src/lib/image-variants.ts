export type PortableImageBinary = ArrayBuffer | ArrayBufferView;

export interface PortableImageMetadata {
  width?: number;
  height?: number;
}

export interface PortableWebpVariantSpec<Key extends string = string> {
  key: Key;
  maxWidth: number;
  maxHeight?: number;
  quality: number;
}

export interface PortableWebpVariant {
  bytes: Uint8Array;
  mime: 'image/webp';
}

type BunImageMetadata = { width?: number | null; height?: number | null };

type BunImagePipeline = {
  buffer: () => Promise<Uint8Array>;
};

type BunImageInstance = {
  metadata: () => Promise<BunImageMetadata>;
  resize: (
    width: number,
    height: number,
    options: { fit: 'inside'; withoutEnlargement: true }
  ) => {
    webp: (options: { quality: number }) => BunImagePipeline;
  };
};

type BunImageConstructor = new (source: PortableImageBinary) => BunImageInstance;

function getBunImageConstructor(): BunImageConstructor {
  const runtime = globalThis as typeof globalThis & {
    Bun?: {
      Image?: BunImageConstructor;
    };
  };

  if (!runtime.Bun?.Image) {
    throw new Error('Bun.Image is not available in this runtime');
  }

  return runtime.Bun.Image;
}

/**
 * Encodes one or more WebP variants from a single source image via Bun.Image.
 *
 * The input image is decoded independently for each variant because Bun.Image
 * resize/encode pipelines are stateful. This keeps the helper portable across
 * API seed and worker usage without introducing shared mutable state.
 */
export async function buildPortableWebpVariants<Key extends string>(
  source: PortableImageBinary,
  specs: readonly PortableWebpVariantSpec<Key>[]
): Promise<{
  metadata: PortableImageMetadata;
  variants: Record<Key, PortableWebpVariant>;
}> {
  const BunImage = getBunImageConstructor();
  const metadata = await new BunImage(source).metadata();

  const variants = await Promise.all(
    specs.map(async (spec) => {
      const maxHeight = spec.maxHeight ?? spec.maxWidth;
      const bytes = await new BunImage(source)
        .resize(spec.maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: spec.quality })
        .buffer();

      return [
        spec.key,
        {
          bytes,
          mime: 'image/webp' as const,
        },
      ] as const;
    })
  );

  return {
    metadata: {
      width: metadata.width ?? undefined,
      height: metadata.height ?? undefined,
    },
    variants: Object.fromEntries(variants) as Record<Key, PortableWebpVariant>,
  };
}
