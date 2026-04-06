require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── CATEGORIES ───────────────────────────────────────────────
    console.log('Seeding categories...');
    await client.query(`
      INSERT INTO categories (name, slug, icon, sort_order) VALUES
        ('Breakfast', 'breakfast', '🌅', 1),
        ('Lunch',     'lunch',     '☀️', 2),
        ('Dinner',    'dinner',    '🌙', 3),
        ('Snacks',    'snacks',    '🍿', 4),
        ('Drinks',    'drinks',    '🥤', 5)
      ON CONFLICT (slug) DO NOTHING
    `);

    // ── ADMIN USER ───────────────────────────────────────────────
    console.log('Seeding admin user...');
    const adminHash = await bcrypt.hash('admin123', 12);
    const { rows: [admin] } = await client.query(`
      INSERT INTO users (name, email, reg_number, password, role)
      VALUES ('Dr. Osei Mensah', 'admin@unieat.ac.tz', 'ADMIN001', $1, 'admin')
      ON CONFLICT (reg_number) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [adminHash]);

    // ── STAFF USER ───────────────────────────────────────────────
    console.log('Seeding staff user...');
    const staffHash = await bcrypt.hash('staff123', 12);
    await client.query(`
      INSERT INTO users (name, email, reg_number, password, role)
      VALUES ('Mary Kiprotich', 'staff@unieat.ac.tz', 'STAFF001', $1, 'staff')
      ON CONFLICT (reg_number) DO NOTHING
    `, [staffHash]);

    // ── STUDENT USER ─────────────────────────────────────────────
    console.log('Seeding student user...');
    const studentHash = await bcrypt.hash('student123', 12);
    await client.query(`
      INSERT INTO users (name, email, reg_number, password, role)
      VALUES ('John Mwangi', 'john.mwangi@student.ac.tz', 'CS/2022/042', $1, 'student')
      ON CONFLICT (reg_number) DO NOTHING
    `, [studentHash]);

    // ── GET CATEGORY IDS ─────────────────────────────────────────
    const { rows: cats } = await client.query('SELECT id, slug FROM categories');
    const catId = cats.reduce((m, c) => ({ ...m, [c.slug]: c.id }), {});

    // ── MENU ITEMS ───────────────────────────────────────────────
    console.log('Seeding menu items...');
    const menuItems = [
      // Breakfast
      ['Mandazi & Chai',       'Deep fried dough with spiced milk tea',       1500, catId.breakfast, '🫖',  'popular', 310, true],
      ['Mkate wa Kusukuma',    'Stir-fried greens on wheat flatbread',        2500, catId.breakfast, '🥬',  'new',     280, true],
      ['Uji wa Wimbi',        'Fermented finger millet porridge',             1000, catId.breakfast, '🥣',  '',        180, true],
      ['Chapati na Maharage',  'Layered flatbread with spiced beans',         2500, catId.breakfast, '🫓',  '',        420, true],
      // Lunch
      ['Ugali na Mchuzi wa Nyama', 'Maize meal with beef stew & greens',     4500, catId.lunch,     '🍛',  'popular', 620, true],
      ['Wali na Maharagwe',    'Rice with red beans in coconut sauce',        3500, catId.lunch,     '🍚',  '',        480, true],
      ['Chips Mayai',          'Fried potato omelette, kachumbari',           3000, catId.lunch,     '🥚',  'popular', 540, true],
      ['Kande',                'Mixed maize & bean stew, traditional',        2500, catId.lunch,     '🫘',  '',        390, true],
      ['Supu ya Ndizi',        'Plantain & beef broth soup',                  3500, catId.lunch,     '🍌',  'new',     310, true],
      ['Makande ya Nazi',      'Maize & beans in coconut milk',               3000, catId.lunch,     '🥥',  '',        430, true],
      // Dinner
      ['Pilau ya Kuku',        'Spiced rice with chicken & whole spices',     6000, catId.dinner,    '🍗',  'popular', 710, true],
      ['Biryani ya Ngombe',    'Slow-cooked beef biryani, raita side',        7000, catId.dinner,    '🍲',  'new',     820, true],
      ['Kuku Paka',            'Chicken in coconut curry, steamed rice',      7000, catId.dinner,    '🍛',  'popular', 750, true],
      ['Wali na Kuku Kienyeji','Free-range chicken, fragrant rice',           7500, catId.dinner,    '🍗',  '',        780, false],
      // Snacks
      ['Samosa (3 pcs)',       'Crispy pastry, minced meat & onion',          2000, catId.snacks,    '🥟',  '',        360, true],
      ['Maandazi (4 pcs)',     'Sweet fried pastry, plain or coconut',        1000, catId.snacks,    '🍩',  '',        290, true],
      ['Vitumbua (5 pcs)',     'Coconut rice pancakes, lightly sweet',        1500, catId.snacks,    '🥞',  '',        340, true],
      ['Bagia & Sauce',        'Split pea fritters, tamarind dip',            1800, catId.snacks,    '🧆',  '',        270, true],
      // Drinks
      ['Tangawizi',            'Fresh ginger juice',                          1000, catId.drinks,    '🧃',  '',        null, true],
      ['Maziwa',               'Fresh whole milk',                            800,  catId.drinks,    '🥛',  '',        null, true],
      ['Chai ya Maziwa',       'Spiced milk tea',                             700,  catId.drinks,    '☕',  '',        null, true],
      ['Madafu',               'Fresh coconut water',                         1500, catId.drinks,    '🥥',  '',        null, true],
      ['Juice ya Embe',        'Fresh mango juice',                           1200, catId.drinks,    '🥭',  '',        null, true],
      ['Maji Baridi',          'Cold mineral water',                          500,  catId.drinks,    '💧',  '',        null, true],
    ];

    for (const [name, description, price, category_id, emoji, badge, calories, is_available] of menuItems) {
      await client.query(`
        INSERT INTO menu_items (name, description, price, category_id, emoji, badge, calories, is_available, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT DO NOTHING
      `, [name, description, price, category_id, emoji, badge || null, calories, is_available, admin.id]);
    }

    // ── SAMPLE ORDERS ────────────────────────────────────────────
    console.log('Seeding sample orders...');
    const { rows: items } = await client.query('SELECT id, name, price FROM menu_items LIMIT 8');

    const sampleOrders = [
      { status: 'served',  provider: 'mpesa',     subtotal: 5500 },
      { status: 'paid',    provider: 'tigopesa',  subtotal: 7000 },
      { status: 'pending', provider: 'mpesa',     subtotal: 3000 },
      { status: 'served',  provider: 'halopesa',  subtotal: 6500 },
      { status: 'paid',    provider: 'mpesa',     subtotal: 4500 },
    ];

    for (const s of sampleOrders) {
      const svc = Math.round(s.subtotal * 0.02);
      const { rows: [order] } = await client.query(`
        INSERT INTO orders (status, subtotal, service_charge, total, guest_name, guest_phone)
        VALUES ($1, $2, $3, $4, 'Sample Student', '0712345678')
        RETURNING id
      `, [s.status, s.subtotal, svc, s.subtotal + svc]);

      if (items.length > 0) {
        const item = items[Math.floor(Math.random() * items.length)];
        await client.query(`
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, subtotal)
          VALUES ($1, $2, $3, 1, $4, $4)
        `, [order.id, item.id, item.name, item.price]);
      }

      await client.query(`
        INSERT INTO payments (order_id, provider, phone_number, amount, status, provider_ref)
        VALUES ($1, $2, '0712345678', $3, $4, $5)
      `, [order.id, s.provider, s.subtotal + Math.round(s.subtotal * 0.02),
          s.status === 'pending' ? 'pending' : 'success',
          'TXN' + Math.random().toString(36).substring(2,10).toUpperCase()]);
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed complete!');
    console.log('─────────────────────────────');
    console.log('  Admin:   ADMIN001  / admin123');
    console.log('  Staff:   STAFF001  / staff123');
    console.log('  Student: CS/2022/042 / student123');
    console.log('─────────────────────────────');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();