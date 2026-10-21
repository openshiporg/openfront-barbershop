export type PasswordFormData = {
  password: string;
};

/** Keep form state useful after errors without returning a submitted secret. */
export function redactPassword<T extends PasswordFormData>(
  formData: T,
): Omit<T, 'password'> & PasswordFormData {
  return { ...formData, password: '' };
}
