import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { requireAuth, signToken } from './auth.js';
import {
  loginSchema,
  categoryCreateSchema,
  subcategoryCreateSchema,
  productUpsertSchema,
  checkoutSchema,
  orderStatusUpdateSchema,
} from './validators.js';
import {
  slugify,
  toCents,
  fromCents,
  orderNumber,
  mapMpStatus,
  mapOrderStatusToEnum,
} from './utils.js';

const prisma = new PrismaClient();

const app = express();

const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Static uploads
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const safe = slugify(file.originalname.replace(/\.[^/.]+$/, '')) || 'file';
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${safe}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function safeJsonParse(schema, data) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const details = parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
    return { ok: false, details };
  }
  return { ok: true, data: parsed.data };
}

function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    price: fromCents(p.priceCents),
    categoryId: p.categoryId,
    subcategoryId: p.subcategoryId || '',
    sizes: p.sizes,
    colors: p.colors,
    description: p.description,
    image: p.image,
    featured: p.featured,
    isNew: p.isNew,
  };
}

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Public: categories
app.get('/api/categories', async (req, res) => {
  const cats = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { subcategories: { orderBy: { name: 'asc' } } },
  });
  res.json(
    cats.map(c => ({
      id: c.id,
      name: c.name,
      subcategories: c.subcategories.map(s => ({ id: s.id, name: s.name, categoryId: s.categoryId })),
    }))
  );
});

// Public: products list
app.get('/api/products', async (req, res) => {
  const { search, categoryId, subcategoryId, featured, isNew } = req.query;

  const where = {};
  if (typeof search === 'string' && search.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }
  if (typeof categoryId === 'string' && categoryId) where.categoryId = categoryId;
  if (typeof subcategoryId === 'string' && subcategoryId) where.subcategoryId = subcategoryId;
  if (featured === 'true') where.featured = true;
  if (isNew === 'true') where.isNew = true;

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
  });

  res.json(products.map(publicProduct));
});

// Public: product detail
app.get('/api/products/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'not_found' });
  return res.json(publicProduct(p));
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  const parsed = safeJsonParse(loginSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'invalid_body', details: parsed.details });

  const { email, password } = parsed.data;
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'server_misconfigured' });

  const token = signToken({ sub: user.id, email: user.email }, secret);
  return res.json({ token });
});

app.get('/api/admin/me', requireAuth, async (req, res) => {
  return res.json({ ok: true, user: { id: req.user.sub, email: req.user.email } });
});

// Admin: upload
app.post('/api/admin/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  const publicUrl = `${process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`}/uploads/${req.file.filename}`;
  res.json({ url: publicUrl });
});

// Admin: categories CRUD
app.get('/api/admin/categories', requireAuth, async (req, res) => {
  const cats = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { subcategories: { orderBy: { name: 'asc' } } },
  });
  res.json(
    cats.map(c => ({
      id: c.id,
      name: c.name,
      subcategories: c.subcategories.map(s => ({ id: s.id, name: s.name, categoryId: s.categoryId })),
    }))
  );
});

app.post('/api/admin/categories', requireAuth, async (req, res) => {
  const parsed = safeJsonParse(categoryCreateSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'invalid_body', details: parsed.details });

  try {
    const cat = await prisma.category.create({ data: { name: parsed.data.name.trim() } });
    res.status(201).json({ id: cat.id, name: cat.name, subcategories: [] });
  } catch (e) {
    res.status(400).json({ error: 'category_create_failed' });
  }
});

app.delete('/api/admin/categories/:id', requireAuth, async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'category_delete_failed' });
  }
});

app.post('/api/admin/categories/:id/subcategories', requireAuth, async (req, res) => {
  const parsed = safeJsonParse(subcategoryCreateSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'invalid_body', details: parsed.details });

  try {
    const sub = await prisma.subcategory.create({
      data: { name: parsed.data.name.trim(), categoryId: req.params.id },
    });
    res.status(201).json({ id: sub.id, name: sub.name, categoryId: sub.categoryId });
  } catch {
    res.status(400).json({ error: 'subcategory_create_failed' });
  }
});

app.delete('/api/admin/subcategories/:id', requireAuth, async (req, res) => {
  try {
    await prisma.subcategory.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'subcategory_delete_failed' });
  }
});

// Admin: products CRUD
app.get('/api/admin/products', requireAuth, async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(products.map(publicProduct));
});

app.post('/api/admin/products', requireAuth, async (req, res) => {
  const parsed = safeJsonParse(productUpsertSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'invalid_body', details: parsed.details });

  const b = parsed.data;
  const slug = b.slug?.trim() ? slugify(b.slug) : slugify(b.name);

  try {
    const p = await prisma.product.create({
      data: {
        name: b.name,
        slug,
        priceCents: toCents(b.price),
        categoryId: b.categoryId,
        subcategoryId: b.subcategoryId || null,
        sizes: b.sizes,
        colors: b.colors,
        description: b.description || '',
        image: b.image,
        featured: !!b.featured,
        isNew: !!b.isNew,
      },
    });
    res.status(201).json(publicProduct(p));
  } catch (e) {
    res.status(400).json({ error: 'product_create_failed' });
  }
});

app.put('/api/admin/products/:id', requireAuth, async (req, res) => {
  const parsed = safeJsonParse(productUpsertSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'invalid_body', details: parsed.details });

  const b = parsed.data;
  const slug = b.slug?.trim() ? slugify(b.slug) : slugify(b.name);

  try {
    const p = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: b.name,
        slug,
        priceCents: toCents(b.price),
        categoryId: b.categoryId,
        subcategoryId: b.subcategoryId || null,
        sizes: b.sizes,
        colors: b.colors,
        description: b.description || '',
        image: b.image,
        featured: !!b.featured,
        isNew: !!b.isNew,
      },
    });
    res.json(publicProduct(p));
  } catch {
    res.status(400).json({ error: 'product_update_failed' });
  }
});

app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'product_delete_failed' });
  }
});

// Admin: orders
app.get('/api/admin/orders', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(
    orders.map(o => ({
      id: o.orderNumber,
      dbId: o.id,
      items: o.items,
      total: fromCents(o.totalCents),
      status: ({
        PENDENTE: 'Pendente',
        ENTREGUE: 'Entregue',
        CANCELADO: 'Cancelado',
        FINALIZADO: 'Finalizado',
      })[o.status],
      createdAt: o.createdAt.toISOString(),
      buyer: o.buyer,
      paymentStatus: o.paymentStatus,
    }))
  );
});

app.patch('/api/admin/orders/:orderNumber/status', requireAuth, async (req, res) => {
  const parsed = safeJsonParse(orderStatusUpdateSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'invalid_body', details: parsed.details });

  const statusEnum = mapOrderStatusToEnum(parsed.data.status);
  try {
    const o = await prisma.order.update({
      where: { orderNumber: req.params.orderNumber },
      data: { status: statusEnum },
    });
    res.json({ ok: true, status: o.status });
  } catch {
    res.status(400).json({ error: 'order_update_failed' });
  }
});

// Checkout (public)
app.post('/api/checkout', async (req, res) => {
  const parsed = safeJsonParse(checkoutSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'invalid_body', details: parsed.details });

  const { items, buyer } = parsed.data;

  // Load products
  const ids = [...new Set(items.map(i => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids } } });
  const byId = new Map(products.map(p => [p.id, p]));

  // Validate cart
  const orderItems = [];
  let totalCents = 0;
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p) return res.status(400).json({ error: 'invalid_product', productId: it.productId });
    const line = p.priceCents * it.quantity;
    totalCents += line;
    orderItems.push({
      product: publicProduct(p),
      quantity: it.quantity,
      selectedSize: it.selectedSize,
      selectedColor: it.selectedColor,
    });
  }

  const orderNum = orderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber: orderNum,
      totalCents,
      items: orderItems,
      buyer,
      status: 'PENDENTE',
      paymentProvider: 'mercadopago',
      paymentStatus: 'PENDING',
    },
  });

  // Mercado Pago preference
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'mp_access_token_missing', orderNumber: order.orderNumber });
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const preferenceBody = {
      items: orderItems.map(oi => ({
        title: oi.product.name,
        quantity: oi.quantity,
        unit_price: oi.product.price,
        currency_id: 'BRL',
      })),
      external_reference: order.orderNumber,
      notification_url: `${process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`}/pagamento/sucesso?o=${order.orderNumber}`,
        pending: `${process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`}/pagamento/pendente?o=${order.orderNumber}`,
        failure: `${process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`}/pagamento/erro?o=${order.orderNumber}`,
      },
      auto_return: 'approved',
    };

    const mpRes = await preference.create({ body: preferenceBody });
    const prefId = mpRes?.id || mpRes?.response?.id;
    const initPoint = mpRes?.init_point || mpRes?.response?.init_point;

    await prisma.order.update({
      where: { id: order.id },
      data: { mpPreferenceId: String(prefId || '') },
    });

    return res.json({
      orderNumber: order.orderNumber,
      checkoutUrl: initPoint,
    });
  } catch (e) {
    console.error('Mercado Pago error', e);
    return res.status(500).json({ error: 'mp_preference_failed', orderNumber: order.orderNumber });
  }
});

// Webhook Mercado Pago
app.post('/api/webhooks/mercadopago', async (req, res) => {
  // Always respond quickly
  res.status(200).send('OK');

  try {
    const body = req.body;
    const dataId = body?.data?.id;
    const type = body?.type;
    if (!dataId || type !== 'payment') return;

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return;

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    const paymentInfo = await payment.get({ id: String(dataId) });
    const info = paymentInfo?.response || paymentInfo;

    const mpStatus = info?.status;
    const extRef = info?.external_reference;
    const mpPaymentId = info?.id ? String(info.id) : String(dataId);
    const mpMerchantOrderId = info?.order?.id ? String(info.order.id) : null;

    if (!extRef) return;

    await prisma.order.update({
      where: { orderNumber: String(extRef) },
      data: {
        paymentStatus: mapMpStatus(mpStatus),
        mpPaymentId,
        mpMerchantOrderId,
      },
    });
  } catch (e) {
    console.error('Webhook handling error', e);
  }
});

// Serve frontend build if available
const distPath = path.resolve(process.cwd(), '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Startup
app.listen(PORT, async () => {
  console.log(`API running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
