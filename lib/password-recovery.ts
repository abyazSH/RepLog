export const recoveryMessages = {
  expired: 'Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru dan buka di browser yang sama.',
  sent: 'Jika email terdaftar, tautan pemulihan akan dikirim. Periksa inbox/spam dan buka tautan di browser ini.',
  password: 'Password minimal 8 karakter, maksimal 128 karakter, dan konfirmasinya harus sama.',
  rateLimit: 'Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba lagi.',
  weakPassword: 'Password belum memenuhi persyaratan keamanan. Gunakan password lebih kuat dengan huruf besar, huruf kecil, angka, dan simbol.',
  samePassword: 'Password baru harus berbeda dari password sebelumnya.',
  sendFailed: 'Email pemulihan belum dapat dikirim. Coba lagi nanti atau hubungi pengelola.',
  updateFailed: 'Password belum berhasil diperbarui. Silakan coba lagi.',
  network: 'Koneksi bermasalah. Silakan coba lagi.',
};

export function validNewPassword(password: string, confirmation: string): boolean {
  return password.length >= 8 && password.length <= 128 && password === confirmation;
}

export function recoveryError(error: {code?: string; status?: number}, updating = false): string {
  if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') return recoveryMessages.rateLimit;
  if (error.code === 'weak_password') return recoveryMessages.weakPassword;
  if (error.code === 'same_password') return recoveryMessages.samePassword;
  if (error.status === 401 || error.status === 403 || ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'otp_expired'].includes(error.code ?? '')) return recoveryMessages.expired;
  return updating ? recoveryMessages.updateFailed : recoveryMessages.sendFailed;
}

type RecoveryAuth = {
  exchangeCodeForSession: (code: string) => Promise<{data: {session: unknown | null}; error: unknown}>;
};

export async function recoveryDestination(auth: RecoveryAuth, url: string): Promise<string> {
  const params = new URL(url).searchParams;
  const code = params.get('code');
  if (code && !params.has('error') && !params.has('error_code')) {
    try {
      const {data, error} = await auth.exchangeCodeForSession(code);
      if (!error && data.session) return '/reset-password';
    } catch { /* An expired or unverifiable link must not open the password form. */ }
  }
  return '/forgot-password?error=expired';
}
