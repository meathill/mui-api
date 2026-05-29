'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface CostTrendDatum {
  name: string;
  cost: number;
  requests: number;
}

interface CostTrendChartProps {
  data: CostTrendDatum[];
  costLabel: string;
}

export default function CostTrendChart({ data, costLabel }: CostTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-rule)" />
        <XAxis dataKey="name" fontSize={12} stroke="var(--brand-mute)" />
        <YAxis fontSize={12} stroke="var(--brand-mute)" />
        <Tooltip />
        <Line type="monotone" dataKey="cost" stroke="var(--brand-yellow-deep)" name={costLabel} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
