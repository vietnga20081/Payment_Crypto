import { useState } from 'react';
import { Table, Tag, Space, Select, Typography, Button, Popconfirm, Modal, Input, message, Steps, Drawer, Descriptions, Timeline } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withdrawalService } from '../../services';
import { formatDate, formatUSDT, wdStatusColor, wdStatusLabel, shortAddress } from '../../utils';
import type { Withdrawal, WithdrawalStatus } from '../../types';
import { useAuthStore } from '../../stores/auth.store';
import { SafetyOutlined } from '@ant-design/icons';

export default function AdminWithdrawalsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [completeModal, setCompleteModal] = useState<{ id: string } | null>(null);
  const [txHash, setTxHash] = useState('');
  const [detail, setDetail] = useState<Withdrawal | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', page, status],
    queryFn: () => withdrawalService.list({ page, limit: 20, status }).then((r) => r.data),
    refetchInterval: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => withdrawalService.approve(id),
    onSuccess: () => { message.success('Đã duyệt'); qc.invalidateQueries({ queryKey: ['admin-withdrawals'] }); },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(e.response?.data?.message || 'Lỗi duyệt rút tiền'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => withdrawalService.reject(id, reason),
    onSuccess: () => {
      message.success('Đã từ chối');
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setRejectModal(null);
      setRejectReason('');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, txHash }: { id: string; txHash: string }) => withdrawalService.markCompleted(id, txHash),
    onSuccess: () => {
      message.success('Đã đánh dấu hoàn thành');
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setCompleteModal(null);
      setTxHash('');
    },
  });

  const retryPayoutMutation = useMutation({
    mutationFn: (id: string) => withdrawalService.retryPayout(id),
    onSuccess: (res) => {
      const completed = res.data.data.status === 'COMPLETED';
      if (completed) message.success('Payout thành công — đã hoàn tất');
      else message.warning('Vẫn thất bại — kiểm tra số dư ví hoặc log gateway-api');
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi thử lại payout'),
  });

  const approvalStep = (w: Withdrawal): number => {
    if (w.status === 'PENDING') return 0;
    if (w.status === 'APPROVED_L1') return 1;
    return 2;
  };

  const columns: ColumnType<Withdrawal>[] = [
    { title: 'Đại lý', dataIndex: ['merchant', 'name'] as string[], ellipsis: true },
    { title: 'Địa chỉ nhận', dataIndex: 'toAddress', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortAddress(v)}</span> },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => formatUSDT(v) },
    {
      title: 'Loại duyệt', dataIndex: 'requiresDualApproval',
      render: (v: boolean) => v ? <Tag icon={<SafetyOutlined />} color="purple">2 bước</Tag> : <Tag>1 bước</Tag>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (s: WithdrawalStatus) => <Tag color={wdStatusColor[s]}>{wdStatusLabel[s]}</Tag>,
    },
    { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate, responsive: ['md'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    {
      title: 'Thao tác',
      render: (_: unknown, r: Withdrawal) => {
        const alreadyApprovedByMe = r.approvals?.some((a) => a.userId === user?.id && a.action === 'APPROVED');
        if (['PENDING', 'APPROVED_L1'].includes(r.status)) {
          return (
            <Space size="small" wrap>
              <Button size="small" onClick={() => setDetail(r)}>Chi tiết</Button>
              <Popconfirm title="Duyệt yêu cầu này?" onConfirm={() => approveMutation.mutate(r.id)}
                disabled={r.status === 'APPROVED_L1' && alreadyApprovedByMe}>
                <Button size="small" type="primary"
                  disabled={r.status === 'APPROVED_L1' && alreadyApprovedByMe}>
                  Duyệt
                </Button>
              </Popconfirm>
              <Button size="small" danger onClick={() => setRejectModal({ id: r.id })}>Từ chối</Button>
            </Space>
          );
        }
        if (r.status === 'PROCESSING') {
          return (
            <Space size="small" wrap>
              <Button size="small" onClick={() => setDetail(r)}>Chi tiết</Button>
              <Button size="small" loading={retryPayoutMutation.isPending} onClick={() => retryPayoutMutation.mutate(r.id)}>
                Thử lại tự động
              </Button>
              <Button size="small" type="primary" onClick={() => setCompleteModal({ id: r.id })}>Đánh dấu xong (thủ công)</Button>
            </Space>
          );
        }
        return <Button size="small" onClick={() => setDetail(r)}>Chi tiết</Button>;
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Quản lý Rút tiền</Typography.Title>
        <Select placeholder="Trạng thái" allowClear style={{ width: 180 }} onChange={setStatus}
          options={Object.entries(wdStatusLabel).map(([v, l]) => ({ value: v, label: l }))} />
      </div>

      <Table
        dataSource={data?.data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 900 }}
        pagination={{ current: page, pageSize: 20, total: data?.meta?.total || 0, onChange: setPage, showTotal: (t) => `Tổng ${t}` }}
      />

      <Modal title="Từ chối yêu cầu rút tiền" open={!!rejectModal}
        onOk={() => rejectMutation.mutate({ id: rejectModal!.id, reason: rejectReason })}
        onCancel={() => { setRejectModal(null); setRejectReason(''); }}
        okText="Xác nhận từ chối" okButtonProps={{ danger: true }}
        confirmLoading={rejectMutation.isPending}>
        <Input.TextArea
          placeholder="Lý do từ chối..." value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)} rows={3} />
      </Modal>

      <Modal title="Đánh dấu đã chuyển tiền" open={!!completeModal}
        onOk={() => completeMutation.mutate({ id: completeModal!.id, txHash })}
        onCancel={() => { setCompleteModal(null); setTxHash(''); }}
        okText="Xác nhận" confirmLoading={completeMutation.isPending}>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Nhập mã giao dịch TRC20 sau khi đã chuyển USDT cho merchant:
        </Typography.Text>
        <Input placeholder="Tx Hash..." value={txHash} onChange={(e) => setTxHash(e.target.value)} />
      </Modal>

      <Drawer title="Chi tiết yêu cầu rút tiền" open={!!detail} onClose={() => setDetail(null)} width={480}>
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size={20}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Đại lý">{detail.merchant?.name}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ nhận">
                <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{detail.toAddress}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Số tiền">{formatUSDT(detail.amount)}</Descriptions.Item>
              <Descriptions.Item label="Phí">{formatUSDT(detail.fee)}</Descriptions.Item>
              <Descriptions.Item label="Thực nhận">{formatUSDT(detail.netAmount)}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><Tag color={wdStatusColor[detail.status]}>{wdStatusLabel[detail.status]}</Tag></Descriptions.Item>
              {detail.txHash && <Descriptions.Item label="TxHash">{detail.txHash}</Descriptions.Item>}
            </Descriptions>

            {detail.requiresDualApproval && (
              <div>
                <Typography.Text strong>Quy trình duyệt 2 bước</Typography.Text>
                <Steps
                  size="small" style={{ marginTop: 12 }}
                  current={approvalStep(detail)}
                  items={[
                    { title: 'Người duyệt 1' },
                    { title: 'Người duyệt 2' },
                    { title: 'Hoàn tất' },
                  ]}
                />
              </div>
            )}

            {(detail.approvals?.length || 0) > 0 && (
              <div>
                <Typography.Text strong>Lịch sử thao tác</Typography.Text>
                <Timeline style={{ marginTop: 12 }} items={detail.approvals!.map((a) => ({
                  color: a.action === 'APPROVED' ? 'green' : 'red',
                  children: (
                    <div>
                      <Typography.Text>{a.user?.email || 'N/A'} — {a.action === 'APPROVED' ? `Duyệt bước ${a.step}` : 'Từ chối'}</Typography.Text>
                      {a.reason && <div><Typography.Text type="secondary">{a.reason}</Typography.Text></div>}
                      <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatDate(a.createdAt)}</Typography.Text></div>
                    </div>
                  ),
                }))} />
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
}
