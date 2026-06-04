"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { ChartPoint } from "@/lib/types";
import { Card } from "@/components/ui/card";

const PIE_COLORS = ["#5ad6ff", "#f97b72", "#f3bb4f", "#7ce7ac"];

export function BarTrendChart({
  title,
  description,
  data,
  secondKey
}: {
  title: string;
  description?: string;
  data: ChartPoint[];
  secondKey?: boolean;
}) {
  return (
    <Card className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" stroke="#7f8ca5" />
            <YAxis stroke="#7f8ca5" />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#59c9ff" radius={[10, 10, 0, 0]} name="Asosiy" />
            {secondKey ? <Bar dataKey="value2" fill="#7ce7ac" radius={[10, 10, 0, 0]} name="Qo'shimcha" /> : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function LineTrendChart({
  title,
  description,
  data,
  secondKey
}: {
  title: string;
  description?: string;
  data: ChartPoint[];
  secondKey?: boolean;
}) {
  return (
    <Card className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" stroke="#7f8ca5" />
            <YAxis stroke="#7f8ca5" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#59c9ff" strokeWidth={3} dot={false} name="Asosiy" />
            {secondKey ? <Line type="monotone" dataKey="value2" stroke="#f3bb4f" strokeWidth={3} dot={false} name="Ikkinchi" /> : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function PieBreakdownChart({
  title,
  description,
  data
}: {
  title: string;
  description?: string;
  data: ChartPoint[];
}) {
  return (
    <Card className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={data} dataKey="value" nameKey="label" outerRadius={88} innerRadius={48} paddingAngle={4}>
              {data.map((entry, index) => (
                <Cell key={`${entry.label}_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
