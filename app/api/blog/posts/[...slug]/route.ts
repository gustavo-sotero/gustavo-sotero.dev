import fs from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    // Obter o caminho do arquivo a partir do slug
    const { slug } = await params;

    const filePath = path.join(process.cwd(), 'content', ...slug);

    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Ler o conteúdo do arquivo
    const content = fs.readFileSync(filePath, 'utf-8');

    // Retornar o conteúdo como texto
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown'
      }
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
