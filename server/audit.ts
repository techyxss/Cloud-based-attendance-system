import { Request } from 'express';
import { dbManager } from './db.ts';

export function logAudit(
  req: Request | null,
  action: string,
  entity: string,
  entityId: string | number,
  details: string,
  userId?: number | null
): void {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').toString() : '127.0.0.1';
    const resolvedUserId = userId ?? (req && (req as any).user ? (req as any).user.id : null);
    const now = new Date().toISOString();

    dbManager.run(`
      INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [resolvedUserId, action, entity, String(entityId), details, ip, now]);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
