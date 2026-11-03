export const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,31}$/;
export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}
export function loginAddress(username: string) {
  const name = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(name))
    throw new Error(
      "Use um login de 3 a 32 caracteres, começando com letra, sem espaços ou acentos.",
    );
  return `${name}@accounts.wisdom.invalid`;
}
export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 6 && value.length <= 128;
}
export function isManager(role: string) {
  return role === "admin" || role === "coordenacao";
}
