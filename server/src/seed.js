import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { slugify, toCents } from './utils.js';

const prisma = new PrismaClient();

const seedCategories = [
  {
    name: 'Camisas',
    subs: ['Social', 'Casual', 'Polo'],
  },
  {
    name: 'Calças',
    subs: ['Jeans', 'Social', 'Sarja'],
  },
  {
    name: 'Acessórios',
    subs: ['Cintos', 'Gravatas', 'Carteiras'],
  },
  {
    name: 'Bermudas',
    subs: ['Sarja', 'Jeans'],
  },
];

const seedProducts = [
  {
    name: 'Camisa Social Slim Ogochi',
    price: 189.9,
    category: 'Camisas',
    sub: 'Social',
    sizes: ['P', 'M', 'G', 'GG'],
    colors: [
      { name: 'Branco', hex: '#FFFFFF', inStock: true },
      { name: 'Azul Claro', hex: '#87CEEB', inStock: true },
      { name: 'Rosa', hex: '#FFB6C1', inStock: true },
    ],
    description: 'Camisa social slim fit da Ogochi, tecido premium com acabamento impecável. Ideal para ocasiões formais e ambientes corporativos.',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=800&fit=crop',
    featured: true,
  },
  {
    name: 'Camisa Casual Listrada',
    price: 149.9,
    category: 'Camisas',
    sub: 'Casual',
    sizes: ['P', 'M', 'G', 'GG'],
    colors: [
      { name: 'Azul Marinho', hex: '#000080', inStock: true },
      { name: 'Verde', hex: '#228B22', inStock: true },
    ],
    description: 'Camisa casual com estampa listrada moderna. Perfeita para o dia a dia com estilo.',
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&h=800&fit=crop',
    featured: true,
  },
  {
    name: 'Calça Jeans Slim',
    price: 219.9,
    category: 'Calças',
    sub: 'Jeans',
    sizes: ['38', '40', '42', '44', '46'],
    colors: [
      { name: 'Azul Escuro', hex: '#191970', inStock: true },
      { name: 'Azul Médio', hex: '#4169E1', inStock: true },
      { name: 'Preto', hex: '#000000', inStock: true },
    ],
    description: 'Calça jeans slim fit com lavagem premium. Conforto e elegância para qualquer ocasião.',
    image: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=600&h=800&fit=crop',
    featured: true,
    isNew: true,
  },
  {
    name: 'Calça Social Alfaiataria',
    price: 259.9,
    category: 'Calças',
    sub: 'Social',
    sizes: ['38', '40', '42', '44', '46'],
    colors: [
      { name: 'Preto', hex: '#000000', inStock: true },
      { name: 'Cinza', hex: '#808080', inStock: true },
      { name: 'Marinho', hex: '#000080', inStock: true },
    ],
    description: 'Calça social em tecido de alfaiataria com caimento perfeito. Elegância que impressiona.',
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop',
    isNew: true,
  },
  {
    name: 'Cinto Couro Legítimo',
    price: 89.9,
    category: 'Acessórios',
    sub: 'Cintos',
    sizes: ['90cm', '100cm', '110cm'],
    colors: [
      { name: 'Preto', hex: '#000000', inStock: true },
      { name: 'Marrom', hex: '#8B4513', inStock: true },
    ],
    description: 'Cinto em couro legítimo com fivela premium. Acabamento de alto padrão.',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=800&fit=crop',
  },
  {
    name: 'Camisa Polo Premium',
    price: 129.9,
    category: 'Camisas',
    sub: 'Polo',
    sizes: ['P', 'M', 'G', 'GG'],
    colors: [
      { name: 'Preto', hex: '#000000', inStock: true },
      { name: 'Branco', hex: '#FFFFFF', inStock: true },
      { name: 'Vermelho', hex: '#DC143C', inStock: true },
    ],
    description: 'Polo premium com tecido piquet de alta qualidade. Conforto e sofisticação no casual.',
    image: 'https://images.unsplash.com/photo-1625910513413-5fc08ef11e5b?w=600&h=800&fit=crop',
    featured: true,
  },
];

async function main() {
  console.log('Seeding database...');

  // Admin
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await prisma.adminUser.create({ data: { email: adminEmail, passwordHash } });
      console.log(`Admin criado: ${adminEmail}`);
    } else {
      console.log('Admin já existe, pulando.');
    }
  } else {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD não definidos, pulando criação do admin.');
  }

  // Categories & subcategories
  for (const c of seedCategories) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name },
    });

    for (const subName of c.subs) {
      await prisma.subcategory.upsert({
        where: {
          name_categoryId: { name: subName, categoryId: cat.id },
        },
        update: {},
        create: { name: subName, categoryId: cat.id },
      });
    }
  }

  // Products
  for (const p of seedProducts) {
    const cat = await prisma.category.findUnique({ where: { name: p.category } });
    if (!cat) continue;
    const sub = await prisma.subcategory.findFirst({ where: { name: p.sub, categoryId: cat.id } });
    const slug = slugify(p.name);

    await prisma.product.upsert({
      where: { slug },
      update: {
        name: p.name,
        priceCents: toCents(p.price),
        categoryId: cat.id,
        subcategoryId: sub?.id ?? null,
        sizes: p.sizes,
        colors: p.colors,
        description: p.description,
        image: p.image,
        featured: !!p.featured,
        isNew: !!p.isNew,
      },
      create: {
        name: p.name,
        slug,
        priceCents: toCents(p.price),
        categoryId: cat.id,
        subcategoryId: sub?.id ?? null,
        sizes: p.sizes,
        colors: p.colors,
        description: p.description,
        image: p.image,
        featured: !!p.featured,
        isNew: !!p.isNew,
      },
    });
  }

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
