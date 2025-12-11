import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

async function getHealthData() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/health`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch health data');
    }

    return await response.json();
  } catch {
    return {
      status: 'error',
      error: 'Failed to fetch health data'
    };
  }
}

export default async function ObservabilityPage() {
  const healthData = await getHealthData();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sistema de Observabilidade</h1>
        <p className="text-muted-foreground">
          Painel de monitoramento da aplicação gustavo-sotero.dev
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Status da Aplicação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Status da Aplicação
              <Badge
                variant={
                  healthData.status === 'healthy' ? 'default' : 'destructive'
                }
              >
                {healthData.status === 'healthy' ? 'Saudável' : 'Com Problemas'}
              </Badge>
            </CardTitle>
            <CardDescription>Estado atual do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Versão:</span>
                <span className="font-mono">{healthData.version || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Ambiente:</span>
                <span className="font-mono">
                  {healthData.environment || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tempo de resposta:</span>
                <span className="font-mono">
                  {healthData.responseTime || 'N/A'}ms
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métricas de Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>Métricas de desempenho do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span className="font-mono">
                  {healthData.uptime
                    ? `${Math.floor(healthData.uptime / 60)}min`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Memória usada:</span>
                <span className="font-mono">
                  {healthData.memory?.used || 'N/A'}MB
                </span>
              </div>
              <div className="flex justify-between">
                <span>Memória total:</span>
                <span className="font-mono">
                  {healthData.memory?.total || 'N/A'}MB
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Web Vitals */}
        <Card>
          <CardHeader>
            <CardTitle>Web Vitals</CardTitle>
            <CardDescription>
              Métricas de experiência do usuário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>LCP (Largest Contentful Paint):</span>
                <Badge variant="outline">Monitorado</Badge>
              </div>
              <div className="flex justify-between">
                <span>FID (First Input Delay):</span>
                <Badge variant="outline">Monitorado</Badge>
              </div>
              <div className="flex justify-between">
                <span>CLS (Cumulative Layout Shift):</span>
                <Badge variant="outline">Monitorado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs e Eventos */}
        <Card>
          <CardHeader>
            <CardTitle>Logs e Eventos</CardTitle>
            <CardDescription>Sistema de logging configurado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Logs de requisições</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Logs de performance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Logs de erro</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Eventos do usuário</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Rastreamento e análises</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Vercel Analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Speed Insights</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Rastreamento de interações</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monitoramento */}
        <Card>
          <CardHeader>
            <CardTitle>Monitoramento</CardTitle>
            <CardDescription>Endpoints de monitoramento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Health Check:</span>
                <Badge variant="outline">/api/health</Badge>
              </div>
              <div className="flex justify-between">
                <span>Métricas:</span>
                <Badge variant="outline">/api/metrics</Badge>
              </div>
              <div className="flex justify-between">
                <span>Última verificação:</span>
                <span className="font-mono text-xs">
                  {new Date(
                    healthData.timestamp || Date.now()
                  ).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instruções */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Como usar o sistema de observabilidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Endpoints disponíveis:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <code>/api/health</code> - Status de saúde da aplicação
                </li>
                <li>
                  <code>/api/metrics</code> - Endpoint para envio de métricas
                  customizadas
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">
                Logs capturados automaticamente:
              </h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Todas as requisições HTTP (middleware)</li>
                <li>Métricas de performance (Web Vitals)</li>
                <li>Erros JavaScript e Promise rejections</li>
                <li>Interações do usuário (cliques, scroll)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">
                Ferramentas externas integradas:
              </h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Vercel Analytics - Análise de tráfego e conversões</li>
                <li>
                  Vercel Speed Insights - Métricas de performance em tempo real
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
