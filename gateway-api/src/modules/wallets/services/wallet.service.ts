import { prisma } from '../../../prisma/client';
import { NotFoundError } from '../../../utils/errors';
import { getPagination, getPaginationMeta } from '../../../utils/response';
import { WalletType, NetworkType } from '@prisma/client';
import TronWeb from 'tronweb';
import { Wallet as EthersWallet } from 'ethers';
import { encryptSecret } from '../../../utils/crypto-vault';

// Internal interface for the TronWeb instance we actually use
interface TronWebInstance {
  createAccount: () => Promise<{ address: { base58: string }; privateKey: string }>;
}

export class WalletService {
  private tronWeb: TronWebInstance;

  constructor() {
    this.tronWeb = new (TronWeb as unknown as new (config: object) => TronWebInstance)({
      fullHost: process.env.TRON_NODE_URL || 'https://api.trongrid.io',
      headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' },
    });
  }

  async list(page: number, limit: number, network?: NetworkType) {
    const { skip, take } = getPagination(page, limit);
    const where = network ? { network } : {};
    const [data, total] = await Promise.all([
      prisma.wallet.findMany({
        where,
        skip, take,
        select: { id: true, address: true, type: true, network: true, balance: true, isActive: true, label: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.wallet.count({ where }),
    ]);
    return { data, meta: getPaginationMeta(total, page, limit) };
  }

  async create(label?: string, type: WalletType = WalletType.HOT, network: NetworkType = NetworkType.TRC20) {
    if (network === NetworkType.BEP20) {
      // BSC dùng cùng chuẩn địa chỉ với Ethereum (secp256k1) — sinh bằng ethers
      const account = EthersWallet.createRandom();
      return prisma.wallet.create({
        data: {
          address: account.address,
          privateKey: encryptSecret(account.privateKey),
          type,
          network,
          label,
          isActive: true,
        },
        select: { id: true, address: true, type: true, network: true, label: true, createdAt: true },
      });
    }

    const account = await this.tronWeb.createAccount();
    return prisma.wallet.create({
      data: {
        address: account.address.base58,
        privateKey: encryptSecret(account.privateKey),
        type,
        network,
        label,
        isActive: true,
      },
      select: { id: true, address: true, type: true, network: true, label: true, createdAt: true },
    });
  }

  async getBalance(id: string) {
    const wallet = await prisma.wallet.findUnique({ where: { id } });
    if (!wallet) throw new NotFoundError('Wallet not found');
    return { address: wallet.address, balance: wallet.balance };
  }
}
