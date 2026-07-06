-- ============================================================
-- Brindari CEO Dashboard — Demo Seed Data
-- ============================================================

-- ── LEADS ──────────────────────────────────────────────────────
insert into leads (company, contact_name, email, phone, country, product_interest, status, deal_value_usd, lead_score, source, notes) values
  ('GreenLife GmbH',        'Klaus Bauer',     'k.bauer@greenlife.de',       '+49 30 1234 5678', 'Germany',        'Moringa Powder',       'qualified',    45000, 82, 'referral',    'Interested in organic certified. Wants sample first.'),
  ('Natura Wellness',       'Sophie Martin',   's.martin@natura.fr',         '+33 1 2345 6789',  'France',         'Moringa Capsules',     'negotiating',  32000, 74, 'website',     'Discussing 500kg trial order. FOB pricing agreed.'),
  ('HealthPlus Ltd',        'James Okoye',     'j.okoye@healthplus.co.uk',   '+44 20 7890 1234', 'United Kingdom', 'Moringa Oil',          'contacted',    18000, 55, 'cold_outreach','Sent intro email. Awaiting response.'),
  ('Vitality Corp',         'Hana Tanaka',     'h.tanaka@vitality.jp',       '+81 3 9876 5432',  'Japan',          'Moringa Tea',          'new',          12000, 40, 'social',      'Found us via LinkedIn. Interested in premium grade.'),
  ('EcoHealth Dubai',       'Ahmad Al-Rashid', 'ahmad@ecohealth.ae',         '+971 4 321 0987',  'United Arab Emirates', 'Moringa Powder', 'closed',   67000, 95, 'referral',    'First order placed. Repeat buyer potential.'),
  ('Natural Origins SA',    'Carlos Mendez',   'c.mendez@naturalorigins.mx', '+52 55 1234 5678', 'Mexico',         'Moringa Leaf Dried',   'lost',          8000, 20, 'email',       'Went with a local supplier. Follow up in 6 months.'),
  ('Purity Health',         'Emma Nielsen',    'e.nielsen@purityhealth.dk',  '+45 33 123 456',   'Denmark',        'Moringa Powder',       'qualified',    28000, 71, 'website',     'Requested COA and spec sheet. Certification important.'),
  ('BioSource NL',          'Lars van Dijk',   'l.vandijk@biosource.nl',     '+31 20 567 8901',  'Netherlands',    'Moringa Capsules',     'new',          15000, 35, 'cold_outreach','Initial contact. Bulk importer.');

-- ── BUYERS (convert qualified leads) ───────────────────────────
insert into buyers (lead_id, company, contact_name, email, phone, country, address, preferred_product, preferred_incoterm, payment_terms, portal_access, total_orders, total_value_usd) values
  ((select id from leads where company = 'EcoHealth Dubai'),
   'EcoHealth Dubai',       'Ahmad Al-Rashid', 'ahmad@ecohealth.ae',    '+971 4 321 0987', 'United Arab Emirates', 'P.O. Box 12345, Dubai', 'Moringa Powder',   'CIF', '50% advance, 50% on BL', true,  2, 134000),
  (null,
   'Alpine Organics AG',    'Thomas Weber',    't.weber@alpine.ch',     '+41 44 789 0123', 'Switzerland',          'Zurich Business Park',  'Moringa Capsules', 'FOB', '30% advance, 70% on BL', false, 1,  48000),
  (null,
   'Sunrise Health Korea',  'Ji-Young Park',   'jy.park@sunrisehealth.kr', '+82 2 3456 7890', 'South Korea',       'Seoul, Gangnam-gu',     'Moringa Powder',   'FOB', '100% advance',           false, 0,      0);

-- ── SUPPLIERS ──────────────────────────────────────────────────
insert into suppliers (company, contact_name, email, location, product, price_per_kg_inr, moq_kg, lead_time_days, certifications, payment_terms, rating, is_active) values
  ('Green Farms Tamil Nadu', 'Ravi Kumar',     'ravi@greenfarms.in',    'Coimbatore, Tamil Nadu', 'Moringa Powder',   285, 500,  7,  ARRAY['FSSAI','Organic','ISO 22000'], '50% advance, 50% on delivery', 4.5, true),
  ('Moringa Marvels',        'Priya Sharma',   'priya@moringam.in',     'Madurai, Tamil Nadu',    'Moringa Powder',   295, 300, 10,  ARRAY['FSSAI','HACCP'],               '100% advance',                 4.0, true),
  ('Pure Leaf Exports',      'Suresh Nair',    'suresh@pureleaf.in',    'Chennai, Tamil Nadu',    'Moringa Capsules', 320, 1000,  5,  ARRAY['FSSAI','Organic','Halal'],     '30% advance, 70% before ship', 4.8, true),
  ('Nilgiri Greens',         'Anand Pillai',   'anand@nilgiri.in',      'Ooty, Tamil Nadu',       'Moringa Leaf Dried', 210, 200, 14,  ARRAY['FSSAI'],                     '50% advance',                  3.5, true);

-- ── SUPPLIER QUOTES ────────────────────────────────────────────
insert into supplier_quotes (supplier_id, product, quantity_kg, price_per_kg_inr, valid_until, quote_date) values
  ((select id from suppliers where company = 'Green Farms Tamil Nadu'), 'Moringa Powder',   500,  285, current_date + 30, current_date - 7),
  ((select id from suppliers where company = 'Green Farms Tamil Nadu'), 'Moringa Powder',   500,  270, current_date - 30, current_date - 45),
  ((select id from suppliers where company = 'Moringa Marvels'),        'Moringa Powder',   300,  295, current_date + 15, current_date - 2),
  ((select id from suppliers where company = 'Moringa Marvels'),        'Moringa Powder',   300,  310, current_date - 15, current_date - 30),
  ((select id from suppliers where company = 'Pure Leaf Exports'),      'Moringa Capsules', 1000, 320, current_date + 45, current_date - 1),
  ((select id from suppliers where company = 'Nilgiri Greens'),         'Moringa Leaf Dried', 200, 210, current_date + 20, current_date - 3),
  ((select id from suppliers where company = 'Nilgiri Greens'),         'Moringa Leaf Dried', 200, 225, current_date - 20, current_date - 40);

-- ── ORDERS ─────────────────────────────────────────────────────
insert into orders (order_number, buyer_id, product, quantity_kg, fob_price_usd, incoterm, hs_code, payment_terms, payment_status, status, shipment_date, estimated_arrival, destination_port, tracking_number, aftership_slug, notes)
values
  ('BRD-2605-0001',
   (select id from buyers where company = 'EcoHealth Dubai'),
   'Moringa Powder', 1000, 3.85, 'FOB', '12099100', '50% advance, 50% on BL', 'paid',    'delivered',    '2026-04-10', '2026-04-28', 'Jebel Ali, Dubai', 'MSCU1234567',  'msc',      'First repeat order. Quality approved.'),
  ('BRD-2605-0002',
   (select id from buyers where company = 'EcoHealth Dubai'),
   'Moringa Powder', 1500, 3.90, 'CIF', '12099100', '50% advance, 50% on BL', 'partial', 'in-transit',   '2026-05-02', '2026-05-20', 'Jebel Ali, Dubai', 'HLCU9876543',  'hapag-lloyd','Balance payment due on delivery.'),
  ('BRD-2605-0003',
   (select id from buyers where company = 'Alpine Organics AG'),
   'Moringa Capsules', 200, 8.50, 'FOB', '21069099', '30% advance, 70% on BL', 'pending', 'quality-check', '2026-05-20', '2026-06-05', 'Hamburg, Germany', null, null, 'Awaiting quality lab report before shipment.'),
  ('BRD-2605-0004',
   (select id from buyers where company = 'Alpine Organics AG'),
   'Moringa Capsules', 250, 8.75, 'FOB', '21069099', '30% advance, 70% on BL', 'pending', 'confirmed',    '2026-06-01', '2026-06-18', 'Zurich via Hamburg', null, null,  'New order. Production scheduled.');

-- ── SHIPMENTS ──────────────────────────────────────────────────
insert into shipments (order_id, tracking_number, carrier, aftership_slug, status, tag, last_update, estimated_delivery, actual_delivery)
values
  ((select id from orders where order_number = 'BRD-2605-0001'),
   'MSCU1234567', 'MSC', 'msc', 'Delivered', 'Delivered', '2026-04-28 09:15:00+00', '2026-04-28', '2026-04-28'),
  ((select id from orders where order_number = 'BRD-2605-0002'),
   'HLCU9876543', 'Hapag-Lloyd', 'hapag-lloyd', 'InTransit', 'InTransit', '2026-05-12 14:30:00+00', '2026-05-20', null);

-- ── INVOICES ───────────────────────────────────────────────────
insert into invoices (invoice_number, order_id, buyer_id, issued_date, due_date, subtotal_usd, tax_amount, total_usd, status, paid_at)
values
  ('INV-202604-001',
   (select id from orders where order_number = 'BRD-2605-0001'),
   (select id from buyers where company = 'EcoHealth Dubai'),
   '2026-04-01', '2026-04-15', 3850.00, 0, 3850.00, 'paid', '2026-04-14 10:30:00+00'),
  ('INV-202605-001',
   (select id from orders where order_number = 'BRD-2605-0002'),
   (select id from buyers where company = 'EcoHealth Dubai'),
   '2026-04-28', '2026-05-12', 5850.00, 0, 5850.00, 'sent', null),
  ('INV-202605-002',
   (select id from orders where order_number = 'BRD-2605-0003'),
   (select id from buyers where company = 'Alpine Organics AG'),
   '2026-05-01', '2026-05-15', 1700.00, 85.00, 1785.00, 'overdue', null),
  ('INV-202606-001',
   (select id from orders where order_number = 'BRD-2605-0004'),
   (select id from buyers where company = 'Alpine Organics AG'),
   '2026-05-10', '2026-05-25', 2187.50, 0, 2187.50, 'draft', null);

-- ── DOCUMENTS ──────────────────────────────────────────────────
insert into documents (order_id, doc_type, file_name, file_url, status, shared_with_buyer)
values
  ((select id from orders where order_number = 'BRD-2605-0001'), 'commercial_invoice',    'INV-202604-001.pdf',           'https://placeholder.com/docs/inv001.pdf',    'shared',   true),
  ((select id from orders where order_number = 'BRD-2605-0001'), 'packing_list',          'PackingList-BRD-2605-0001.pdf','https://placeholder.com/docs/pl001.pdf',     'shared',   true),
  ((select id from orders where order_number = 'BRD-2605-0001'), 'bill_of_lading',        'BL-MSCU1234567.pdf',           'https://placeholder.com/docs/bl001.pdf',     'verified', true),
  ((select id from orders where order_number = 'BRD-2605-0001'), 'certificate_of_origin', 'COO-BRD-2605-0001.pdf',        'https://placeholder.com/docs/coo001.pdf',    'verified', true),
  ((select id from orders where order_number = 'BRD-2605-0001'), 'phytosanitary',         'Phyto-BRD-2605-0001.pdf',      'https://placeholder.com/docs/phyto001.pdf',  'verified', false),
  ((select id from orders where order_number = 'BRD-2605-0001'), 'fssai',                 'FSSAI-Certificate-2026.pdf',   'https://placeholder.com/docs/fssai.pdf',     'verified', false),
  ((select id from orders where order_number = 'BRD-2605-0002'), 'commercial_invoice',    'INV-202605-001.pdf',           'https://placeholder.com/docs/inv002.pdf',    'uploaded', false),
  ((select id from orders where order_number = 'BRD-2605-0002'), 'packing_list',          'PackingList-BRD-2605-0002.pdf','https://placeholder.com/docs/pl002.pdf',     'uploaded', false);

-- ── FOB CALCULATIONS ───────────────────────────────────────────
insert into fob_calculations (product, quantity_kg, ex_works_inr, inland_freight_inr, export_charges_inr, fob_usd, margin_percent, destination_country, notes)
values
  ('Moringa Powder',   1000, 285000, 8000, 6000, 3.59, 7.2, 'United Arab Emirates', 'Standard 1MT calculation for Dubai CIF'),
  ('Moringa Capsules',  200, 64000,  3000, 4500, 0.86, 14.5,'Switzerland',           'Alpine Organics trial order pricing'),
  ('Moringa Powder',    500, 142500, 5000, 5500, 1.84, 5.1, 'Germany',               'GreenLife GmbH quote — needs 20%+ margin');

-- ── EMAIL CAMPAIGNS ────────────────────────────────────────────
insert into email_campaigns (name, product, target_country, status, total_leads, emails_sent, replies_received, interested_count)
values
  ('Germany Moringa Powder Q2',    'Moringa Powder',   'Germany',    'active',    12, 12, 3, 1),
  ('UAE Bulk Outreach May',         'Moringa Powder',   'United Arab Emirates', 'completed', 8, 8, 4, 2),
  ('France Capsules Campaign',      'Moringa Capsules', 'France',     'draft',      6,  0, 0, 0),
  ('UK Premium Oil Launch',         'Moringa Oil',      'United Kingdom', 'paused', 5,  5, 1, 0);
