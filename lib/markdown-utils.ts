'use client';

/**
 * Carrega o conteúdo de um arquivo markdown
 * @param contentPath Caminho para o arquivo markdown
 * @returns Conteúdo do arquivo ou null se não for possível carregar
 */
export async function fetchMarkdownContent(
	contentPath: string
): Promise<string | null> {
	try {
		// Se o caminho começa com '/', remove para obter o caminho relativo
		const relativePath = contentPath.startsWith('/')
			? contentPath.substring(1)
			: contentPath;

		// Converte o caminho do arquivo para o formato da API
		// Se for content/blog/en/file.md, converte para /api/blog/posts/blog/en/file.md
		const apiPath = `/api/blog/posts/${relativePath.replace(/^content\//, '')}`;

		// Faz a requisição para a API
		const response = await fetch(apiPath);

		if (!response.ok) {
			throw new Error(`Failed to fetch ${apiPath}: ${response.statusText}`);
		}

		const content = await response.text();
		return content;
	} catch (error) {
		console.error(`Error loading markdown content from ${contentPath}:`, error);
		return null;
	}
}
