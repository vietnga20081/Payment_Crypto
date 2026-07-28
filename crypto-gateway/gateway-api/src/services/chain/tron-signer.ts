import TronWeb from 'tronweb';
import { decryptSecret } from '../../utils/crypto-vault';

interface TronWebInstance {
  setPrivateKey: (pk: string) => void;
  contract: () => {
    at: (address: string) => Promise<{
      transfer: (to: string, amount: string) => {
        send: (opts: { feeLimit: number }) => Promise<string>;
      };
    }>;
  };
}

const USDT_CONTRACT = process.env.USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

function getTronWeb(): TronWebInstance {
  return new (TronWeb as unknown as new (cfg: object) => TronWebInstance)({
    fullHost: process.env.TRON_NODE_URL || 'https://api.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' },
  });
}

/**
 * Gửi USDT-TRC20 thật trên chuỗi TRON. `encryptedPrivateKey` là giá trị đã mã
 * hoá lấy trực tiếp từ cột `wallet.privateKey` — hàm này tự giải mã trước khi
 * ký, không bao giờ log ra private key dạng plain.
 */
export async function sendUsdtTrc20(encryptedPrivateKey: string, toAddress: string, amount: number): Promise<string> {
  const tronWeb = getTronWeb();
  tronWeb.setPrivateKey(decryptSecret(encryptedPrivateKey));
  const contract = await tronWeb.contract().at(USDT_CONTRACT);
  const amountSun = Math.floor(amount * 1_000_000).toString(); // USDT-TRC20: 6 số thập phân
  return contract.transfer(toAddress, amountSun).send({ feeLimit: 50_000_000 });
}
