import { useState } from 'react';
import { Card, Table, Button, Input, Space, Switch, Tag, Popconfirm, message, Typography, Alert } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipWhitelistService, merchantService } from '../../services';
import { formatDate } from '../../utils';
import { PlusOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import type { IpWhitelistEntry } from '../../types';

export default function IpWhitelistCard() {
  const qc = useQueryClient();
  const [newIp, setNewIp] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['merchant-profile'],
    queryFn: () => merchantService.getProfile().then((r) => r.data.data),
  });

  const { data: ips, isLoading } = useQuery({
    queryKey: ['my-ip-whitelist'],
    queryFn: () => ipWhitelistService.myList().then((r) => r.data.data),
  });

  const addMutation = useMutation({
    mutationFn: () => ipWhitelistService.myAdd(newIp, newLabel || undefined),
    onSuccess: () => {
      message.success('Đã thêm IP');
      qc.invalidateQueries({ queryKey: ['my-ip-whitelist'] });
      setNewIp(''); setNewLabel('');
    },
    onError: () => message.error('Địa chỉ IP không hợp lệ'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => ipWhitelistService.myRemove(id),
    onSuccess: () => { message.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['my-ip-whitelist'] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => ipWhitelistService.toggleRestriction(enabled),
    onSuccess: () => { message.success('Đã cập nhật'); qc.invalidateQueries({ queryKey: ['merchant-profile'] }); },
  });

  const columns: ColumnType<IpWhitelistEntry>[] = [
    { title: 'Địa chỉ IP', dataIndex: 'ipAddress', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    { title: 'Ghi chú', dataIndex: 'label', render: (v?: string) => v || '-' },
    { title: 'Ngày thêm', dataIndex: 'createdAt', render: formatDate },
    {
      title: '', render: (_: unknown, r: { id: string }) => (
        <Popconfirm title="Xóa IP này?" onConfirm={() => removeMutation.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card title={<Space><SafetyOutlined />Giới hạn IP gọi API</Space>}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Text>Bật giới hạn IP cho API Key (LIVE)</Typography.Text>
          <Switch
            checked={profile?.ipRestrictionEnabled}
            onChange={(v) => toggleMutation.mutate(v)}
            loading={toggleMutation.isPending}
          />
        </div>

        {profile?.ipRestrictionEnabled && (ips?.length || 0) === 0 && (
          <Alert type="warning" showIcon message="Đã bật giới hạn IP nhưng chưa có IP nào trong danh sách — mọi request LIVE API sẽ bị chặn!" />
        )}

        <Space.Compact style={{ width: '100%' }}>
          <Input placeholder="VD: 203.0.113.10" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
          <Input placeholder="Ghi chú (tuỳ chọn)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} style={{ maxWidth: 180 }} />
          <Button type="primary" icon={<PlusOutlined />} loading={addMutation.isPending}
            disabled={!newIp} onClick={() => addMutation.mutate()}>
            Thêm
          </Button>
        </Space.Compact>

        <Table
          dataSource={ips || []} columns={columns} rowKey="id"
          loading={isLoading} pagination={false} size="small"
        />
      </Space>
    </Card>
  );
}
