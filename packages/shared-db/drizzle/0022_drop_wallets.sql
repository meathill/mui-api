-- 删除遗留的 wallets 表：早期 Stripe 集成的 D1 余额副本，从未被现行写路径维护（生产 0 行）。
-- 余额权威账本在 WalletDO，KV `user:{userId}` 为只读展示镜像。
DROP TABLE IF EXISTS `wallets`;
