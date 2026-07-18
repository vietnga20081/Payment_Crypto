import { useState } from 'react';
import { Table, Typography, Tag } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { auditService } from '../../services';
import { formatDate } from '../../utils';

interface AuditRow {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { email: string; role: string };
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => auditService.list({ page, limit: 50 }).then((r) => r.data),
  });

  const columns: ColumnType<AuditRow>[] = [
    { title: 'Người dùng', dataIndex: ['user', 'email'] as string[], ellipsis: true, render: (v?: string) => v || 'System' },
    { title: 'Hành động', dataIndex: 'action', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Tài nguyên', dataIndex: 'resource' },
    { title: 'Resource ID', dataIndex: 'resourceId', ellipsis: true },
    { title: 'IP', dataIndex: 'ipAddress', responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>Audit Logs</Typography.Title>
      <Table
        dataSource={(data?.data as AuditRow[]) || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 700 }}
        pagination={{ current: page, pageSize: 50, total: data?.meta?.total || 0, onChange: setPage, showTotal: (t) => `Tổng ${t}` }}
        size="small"
      />
    </div>
  );
}
