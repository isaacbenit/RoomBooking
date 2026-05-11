export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

