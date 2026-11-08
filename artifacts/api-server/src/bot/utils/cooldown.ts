const cooldowns = new Map<string, Map<string, number>>();

export function checkCooldown(userId: string, commandName: string, cooldownSeconds: number): number | null {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }
  const userCooldowns = cooldowns.get(commandName)!;
  const now = Date.now();
  const expiry = userCooldowns.get(userId);

  if (expiry && now < expiry) {
    return Math.ceil((expiry - now) / 1000);
  }

  userCooldowns.set(userId, now + cooldownSeconds * 1000);
  return null;
}

export function clearCooldown(userId: string, commandName: string): void {
  cooldowns.get(commandName)?.delete(userId);
}
