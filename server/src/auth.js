import jwt from 'jsonwebtoken';

export function signToken(payload, secret, expiresIn = '7d') {
  return jwt.sign(payload, secret, { expiresIn });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'server_misconfigured' });
    req.user = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}
