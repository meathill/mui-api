/**
 * 将邮箱归一化为账号唯一标识：整体小写，并移除本地部分的 + 别名。
 * 只处理 + 别名，不合并 Gmail 点号等供应商特有规则。
 */
export function normalizeAuthEmail(rawEmail: string): string {
  const email = rawEmail.trim().toLowerCase();
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) return email;

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const baseLocalPart = localPart.split('+', 1)[0];
  return `${baseLocalPart}@${domain}`;
}

export function hasAuthEmailAlias(rawEmail: string): boolean {
  const email = rawEmail.trim();
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) return false;
  return email.slice(0, atIndex).includes('+');
}

export function getAuthEmailDefaultName(rawEmail: string): string {
  const email = normalizeAuthEmail(rawEmail);
  const atIndex = email.indexOf('@');
  return atIndex > 0 ? email.slice(0, atIndex) : email;
}
