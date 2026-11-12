const STORAGE_KEY = "lenscraft_guest_prescription_token";

/** App proxies do not preserve browser cookies. Keep only this opaque owner token client-side. */
export function getGuestPrescriptionToken(): string {
  let token = window.localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token = window.crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}
