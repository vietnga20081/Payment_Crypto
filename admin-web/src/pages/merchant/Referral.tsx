import { Card, Input, Typography, Space, Alert, Table, Tag, Statistic, Row, Col, message } from 'antd';
import { GiftOutlined, CopyOutlined, TeamOutlined, DollarOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { merchantService } from '../../services';
import { formatDate, formatUSDT } from '../../utils';

export default function ReferralPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['merchant-referrals'],
    queryFn: () => merchantService.getReferrals().then((r) => r.data.data),
  });

  const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('Đã sao chép'); };

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        <Space><GiftOutlined /> Giới thiệu bạn bè</Space>
      </Typography.Title>

      {data && (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Chia sẻ link dưới đây — Đại lý đăng ký qua link của bạn sẽ được ghi nhận là do bạn giới thiệu."
          />

          <Card style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <div>
                <Typography.Text type="secondary">Mã giới thiệu của bạn</Typography.Text>
                <Input
                  size="large"
                  value={data.referralCode}
                  readOnly
                  addonAfter={<CopyOutlined style={{ cursor: 'pointer' }} onClick={() => copy(data.referralCode)} />}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Link đăng ký kèm mã giới thiệu</Typography.Text>
                <Input
                  size="large"
                  value={`${window.location.origin}/register?ref=${data.referralCode}`}
                  readOnly
                  addonAfter={
                    <CopyOutlined
                      style={{ cursor: 'pointer' }}
                      onClick={() => copy(`${window.location.origin}/register?ref=${data.referralCode}`)}
                    />
                  }
                />
              </div>
            </Space>
          </Card>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12}>
              <Card>
                <Statistic title="Đã giới thiệu" value={data.referrals.length} prefix={<TeamOutlined />} suffix="Đại lý" />
              </Card>
            </Col>
            <Col xs={12}>
              <Card>
                <Statistic
                  title="Tổng hoa hồng đã nhận"
                  value={formatUSDT(data.totalCommissionEarned)}
                  prefix={<DollarOutlined />}
                  suffix="USDT"
                />
              </Card>
            </Col>
          </Row>

          <Card title={`Đại lý đã giới thiệu (${data.referrals.length})`} style={{ marginBottom: 16 }}>
            <Table
              size="small"
              rowKey="id"
              loading={isLoading}
              dataSource={data.referrals}
              pagination={false}
              locale={{ emptyText: 'Chưa có Đại lý nào đăng ký qua link của bạn' }}
              columns={[
                { title: 'Tên Đại lý', dataIndex: 'name' },
                { title: 'Email', dataIndex: ['user', 'email'] },
                {
                  title: 'Trạng thái', dataIndex: 'status',
                  render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag>,
                },
                { title: 'Ngày tham gia', dataIndex: 'createdAt', render: formatDate },
              ]}
            />
          </Card>

          <Card title="Lịch sử hoa hồng">
            <Table
              size="small"
              rowKey="id"
              dataSource={data.commissionHistory}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: 'Chưa có hoa hồng nào — có thể chương trình giới thiệu chưa được Admin bật, hoặc người bạn giới thiệu chưa có giao dịch hoàn tất.' }}
              columns={[
                { title: 'Từ Đại lý', dataIndex: ['referred', 'name'] },
                { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => `${formatUSDT(v)} USDT` },
                { title: 'Tỉ lệ áp dụng', dataIndex: 'commissionRate', render: (v: string) => `${(Number(v) * 100).toFixed(1)}%` },
                { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
