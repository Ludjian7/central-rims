import { Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { AuthRequest } from './auth.js';

export const activityLogger = (resourceType: string, actionDesc?: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // We capture the original send/json to perform logging after response is sent
    // so we don't block the actual API response time.
    const originalJson = res.json;

    res.json = function (body) {
      res.locals.body = body;
      return originalJson.call(this, body);
    };

    res.on('finish', async () => {
      // Only log successful mutating requests or specific actions
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

      if (isSuccess && (isMutating || actionDesc)) {
        const action = actionDesc || `${req.method} ${req.route?.path || req.path}`;
        const userId = req.user?.id;

        // Try extracting potential resourceId from response or request
        let resourceId = null;
        if (req.params.id) {
          resourceId = parseInt(req.params.id as string, 10);
        } else if (res.locals.body?.data?.id) {
          resourceId = parseInt(res.locals.body.data.id, 10);
        }

        if (userId) {
          try {
            await prisma.activityLog.create({
              data: {
                userId,
                action,
                resourceType,
                resourceId: isNaN(resourceId as number) ? null : resourceId,
                details: JSON.stringify({
                  method: req.method,
                  query: req.query,
                  body: req.method !== 'GET' ? req.body : undefined,
                  ip: req.ip,
                }),
              },
            });
          } catch (error) {
            console.error('[ActivityLogger] Failed to log activity:', error);
          }
        }
      }
    });

    next();
  };
};
