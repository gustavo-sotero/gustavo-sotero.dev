'use client';

import type { TopPost } from '@portfolio/shared';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/* ─────────────────────── Top Posts Bar Chart ─────────────────────── */

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-400 mb-1 max-w-45 truncate">{label}</p>
      <p className="text-sm font-semibold text-emerald-400">
        {payload[0].value.toLocaleString('pt-BR')}{' '}
        <span className="text-xs font-normal text-zinc-500">views</span>
      </p>
    </div>
  );
}

interface TopPostsChartProps {
  data: TopPost[];
  isLoading?: boolean;
}

export function TopPostsChart({ data, isLoading }: TopPostsChartProps) {
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="flex gap-1 items-end h-32 w-full px-4">
          {(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] as const).map((id) => (
            <div key={id} className="flex-1 rounded-t bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-sm text-zinc-600">Nenhum dado de visualização disponível</p>
      </div>
    );
  }

  // Shorten paths for display
  const chartData = data.map((item) => ({
    ...item,
    shortPath: item.path.replace('/blog/', '').replace('/projects/', '').slice(0, 28),
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="shortPath"
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={48}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="views" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─────────────────────── Pageviews Area Chart ─────────────────────── */

interface PageviewPoint {
  date: string;
  views: number;
}

interface PageviewsChartProps {
  data: PageviewPoint[];
  isLoading?: boolean;
}

function PageviewTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-emerald-400">
        {payload[0].value.toLocaleString('pt-BR')}{' '}
        <span className="text-xs font-normal text-zinc-500">views</span>
      </p>
    </div>
  );
}

export function PageviewsChart({ data, isLoading }: PageviewsChartProps) {
  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-full h-32 px-4 flex items-end gap-0.5">
          {(Array.from({ length: 30 }, (_, i) => `pv-${i}`) as string[]).map((id) => (
            <div key={id} className="flex-1 rounded-sm bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="text-sm text-zinc-600">Nenhum dado no período selecionado</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={192}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => {
            const d = new Date(v);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
        />
        <Tooltip
          content={<PageviewTooltip />}
          cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="views"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#viewsGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
