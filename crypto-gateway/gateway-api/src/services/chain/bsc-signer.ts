import { ethers } from 'ethers';
import { decryptSecret } from '../../utils/crypto-vault';

const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDT_CONTRACT_ADDRESS = process.env.USDT_BEP20_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
const USDT_DECIMALS = 18; // Binance-Peg USDT (BEP20) dùng 18 số thập phân

const ERC20_TRANSFER_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

/**
 * Gửi USDT-BEP20 thật trên chuỗi BSC. `encryptedPrivateKey` là giá trị đã mã
 * hoá lấy trực tiếp từ cột `wallet.privateKey` — hàm này tự giải mã trước khi
 * ký, không bao giờ log ra private key dạng plain. Đợi 1 confirmation trước
 * khi coi là gửi thành công (tránh báo completed cho giao dịch bị revert).
 */
export async function sendUsdtBep20(encryptedPrivateKey: string, toAddress: string, amount: number): Promise<string> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(decryptSecret(encryptedPrivateKey), provider);
  const contract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_TRANSFER_ABI, signer);

  const amountWei = ethers.parseUnits(amount.toFixed(USDT_DECIMALS), USDT_DECIMALS);
  const tx = await contract.transfer(toAddress, amountWei);
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`Giao dịch BEP20 bị revert hoặc thất bại (tx: ${tx.hash})`);
  }

  return tx.hash as string;
}
