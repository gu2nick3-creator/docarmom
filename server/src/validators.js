import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
});

export const subcategoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
});

export const productColorSchema = z.object({
  name: z.string().min(1).max(40),
  hex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  inStock: z.boolean().default(true),
});

export const productUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  price: z.number().positive(),
  categoryId: z.string().min(1),
  subcategoryId: z.string().optional().nullable(),
  sizes: z.array(z.string().min(1).max(20)).default([]),
  colors: z.array(productColorSchema).default([]),
  description: z.string().default(''),
  image: z.string().min(1),
  featured: z.boolean().optional().default(false),
  isNew: z.boolean().optional().default(false),
  slug: z.string().optional(),
});

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(99),
  selectedSize: z.string().min(1),
  selectedColor: z.string().min(1),
});

export const buyerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  cpf: z.string().min(8),
  phone: z.string().min(8),
  address: z.object({
    street: z.string().min(1),
    number: z.string().min(1),
    complement: z.string().optional().default(''),
    neighborhood: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    cep: z.string().min(5),
  }),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1),
  buyer: buyerSchema,
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(['Pendente', 'Entregue', 'Cancelado', 'Finalizado']),
});
