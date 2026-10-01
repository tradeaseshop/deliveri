import { Router } from 'express';
import authRoutes from './routes/auth';
import driverRoutes from './routes/drivers';
import adminRoutes from './routes/admins';
import deliveryRoutes from './routes/deliveries';
import earningsRoutes from './routes/earnings';
import notificationRoutes from './routes/notifications';
import webhookRoutes from './routes/webhooks';
import integrationRoutes from './routes/integrations';
import financeRoutes from './routes/finance';

const api = Router();

api.use('/auth', authRoutes);
api.use('/drivers', driverRoutes);
api.use('/admins', adminRoutes);
api.use('/deliveries', deliveryRoutes);
api.use('/earnings', earningsRoutes);
api.use('/notifications', notificationRoutes);
api.use('/webhooks', webhookRoutes); // /webhooks/tradeease/orders — inbound fulfilment requests
api.use('/integrations', integrationRoutes);
api.use('/finance', financeRoutes); // admin-only integration health/event visibility

export default api;
