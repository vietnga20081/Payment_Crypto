import { Card, Statistic, Skeleton } from 'antd';
import React from 'react';

interface StatCardProps {
  title: string;
  value?: string | number;
  prefix?: React.ReactNode;
  suffix?: string;
  loading?: boolean;
  color?: string;
  formatter?: (val: string | number) => string;
}

export default function StatCard({ title, value, prefix, suffix, loading, color, formatter }: StatCardProps) {
  return (
    <Card style={{ height: '100%' }}>
      {loading ? (
        <Skeleton active paragraph={false} />
      ) : (
        <Statistic
          title={title}
          value={value}
          prefix={prefix}
          suffix={suffix}
          formatter={formatter ? (v) => formatter(v as string | number) : undefined}
          valueStyle={{ color }}
        />
      )}
    </Card>
  );
}
