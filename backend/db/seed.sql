
-- TRUCKS
INSERT INTO trucks (truck_number, driver_name, avg_kmpl) VALUES
  ('8596', 'Bashunath',        4.2),
  ('8597', 'Bibek Bista',       4.2),
  ('8598', 'Om Bahadur Gurung', 4.2),
  ('8599', 'Bibek Bista',       4.2),
  ('8600', 'Suman Lama Thokar', 4.2),
  ('0122', 'Madhav Karki',      4.2);
  

-- SOURCES
-- Source coordinates: Maruti is based in Kathmandu / Bhaktapur industrial area
INSERT INTO sources (name, address, lat, lng) VALUES
  ('Maruti Print & Pack Limited',     'Chorni 44400 , Birgunj , Nepal', 27.6710, 85.4298),
  ('Maruti Graphics Limited',         'Chorni 44400 , Birgunj , Nepal', 27.6710, 85.4298),
  ('Shree Maruti and Paper Pvt Ltd',  'Chorni 44400 , Birgunj , Nepal', 27.6710, 85.4298)
ON CONFLICT (name) DO NOTHING;


INSERT INTO customers (name, destination_address, destination_lat, destination_lng, freight_actual, freight_dhuwwani) VALUES
  ('AMTECH MED (P.) LTD',                              'Kathmandu, Nepal',       27.7172, 85.3240, 11000,  11000*1.3),
  ('ANTARCTIC BISCUITS PRIVATE LIMITED',               'Hetauda, Nepal',         27.4286, 85.0317, 11000,  11000*1.3),
  ('ASIAN BISCUIT & CONFECTIONERY LTD',                'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('ASIAN THAI FOODS LTD.',                            'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('B.H.P. MANUFACTURING PVT.LTD',                    'Kathmandu, Nepal',       27.7172, 85.3240, 6000,   6000*1.3),
  ('BIRAT HEALTHCARE INDUSTRIES PVT. LTD.',            'Biratnagar, Nepal',      26.4525, 87.2718, 28000,  28000*1.3),
  ('BOTTLERS NEPAL (TERAI) LIMITED',                   'Bharatpur, Nepal',       27.6833, 84.4333, 18000,  18000*1.3),
  ('CHANDIKA DISTILLERY PVT LTD.',                     'Rangeli, Nepal',         26.4667, 87.4333, 30000,  30000*1.3),
  ('CHANDRA SHIV RICE & OIL MILLS PVT LTD',           'Biratnagar, Nepal',      26.4525, 87.2718, 28000,  28000*1.3),
  ('DABUR NEPAL PRIVATE LIMITED',                      'Simra, Nepal',           27.1583, 84.9800, 5500,   5500*1.3),
  ('DUGAR EDIBLES PVT LTD',                            'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('DUGAR SPICES & PRODUCTS PVT LTD',                  'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('GAUSHALA GENERAL STORES',                          'Mahottari, Nepal',       26.6500, 85.9167, 15000,  15000*1.3),
  ('GORKHA BREWERY PVT LTD',                           'Bharatpur, Nepal',       27.6833, 84.4333, 18000,  18000*1.3),
  ('HEALTH AND HYGIENE PRODUCTS PVT LTD',              'Biratnagar, Nepal',      26.4525, 87.2718, 28000,  28000*1.3),
  ('HIMALAYAN DISTILLERY LTD',                         'Kathmandu, Nepal',       27.7172, 85.3240, 5500,   5500*1.3),
  ('HIMALI KATTHA UDYOG',                              'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('HIMSHREE FOODS PVT LTD',                           'Pokhara, Nepal',         NULL,    NULL,    31000,  31000*1.3),
  ('JAGDAMBA SPINNING MILLS LIMITED',                  'Bhairahawa, Nepal',      27.5036, 83.4486, 27000,  27000*1.3),
  ('JANAKPUR AGRO FARM LIMITED',                       'Janakpur, Nepal',        26.7288, 85.9258, 16000,  16000*1.3),
  ('JASHN TRADING HOUSE',                              'Biratnagar, Nepal',      NULL,    NULL,    NULL,   NULL),
  ('JAWALAKHEL DISTILLERY PVT.LTD.',                   'Bhairahawa, Nepal',      27.5036, 83.4486, 27000,  27000*1.3),
  ('KAWALITY CHEM PVT LTD',                            'Biratnagar, Nepal',      26.4525, 87.2718, 28000,  28000*1.3),
  ('KAWALITY OIL REFINERY PVT LTD',                    'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('KIRITI PRINT AND PACK INDUSTRIES',                 'Biratnagar, Nepal',      26.4525, 87.2718, 28000,  28000*1.3),
  ('KWALITY DIET AND FOOD PRODUCTS PVT LTD',           'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('KWALITY FOODS NEPAL PVT LTD',                      'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('KWALITY NOODLES INDUSTRIES PVT LTD',               'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('KWALITY THAI FOODS PVT LTD',                       'Biratnagar, Nepal',      26.4525, 87.2718, 28000,  28000*1.3),
  ('LAKSHYA POULTRY PVT LTD',                          'Hetauda, Nepal',         NULL,    NULL,    17000,  17000*1.3),
  ('MM PLASTIC UDYOG PVT.LTD.',                        'Biratnagar, Nepal',      26.4525, 87.2718, 28000,  28000*1.3),
  ('PASHUPATI PAINTS PVT LTD',                         'Biratnagar, Nepal',      26.4525, 87.2718, 28000,  28000*1.3),
  ('PREMIER DISTILLERY LTD',                           'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('PRIME CERAMICS PVT. LTD.',                         'Kathmandu, Nepal',       27.7172, 85.3240, 13000,  13000*1.3),
  ('RAJ BREWERY PVT LTD',                              'Bhairahawa, Nepal',      27.5036, 83.4486, 27000,  27000*1.3),
  ('RAM JANAKI TEL REFINE TATHA PACKAGING UDHYOG PVT . LTD', 'Bhairahawa, Nepal',      NULL,    NULL,    17000,  17000*1.3),
  ('SARAS BEVERAGES PVT. LTD.',                        'Kathmandu, Nepal',       NULL,    NULL,    19000,  19000*1.3),
  ('SHAKTI KALIKA POULTRY PVT LTD',                    'Hetauda, Nepal',         NULL,    NULL,    17000,  17000*1.3),
  ('SHREE DISTILLERY LTD',                             'Narayanghat, Nepal',     27.7031, 84.3825, 21000,  21000*1.3),
  ('SHREE PASHUPATI BISCUITS INDUSTRIES PVT LTD',      'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('SIDDHARTHA OIL INDUSTRIES',                        'Bhairahawa, Nepal',      27.5036, 83.4486, 27000,  27000*1.3),
  ('SIDDHARTHA PET PLAST INDUSTRIES PVT LTD',          'Bhairahawa, Nepal',      27.5036, 83.4486, 27000,  27000*1.3),
  ('SUNSHINE FOODS PRIVATE LIMITED',                   'Bhairahawa, Nepal',      27.5036, 83.4486, 27000,  27000*1.3),
  ('SURYA NEPAL PVT LTD brt',                          'Biratnagar, Nepal',      26.4525, 87.2718, 27000,  27000*1.3),
  ('TIGER BREWERY INDUSTRY PVT LTD',                   'Bhairahawa, Nepal',      27.5036, 83.4486, 28000,  28000*1.3),
  ('YAK BREWING COMPANY PVT LTD',                      'Bharatpur, Nepal',       27.6833, 84.4333, 21000,  21000*1.3),
  ('YASHODA FOODS PVT. LTD.',                          'Bhairahawa, Nepal',      27.5036, 83.4486, 28000,  28000*1.3),
  ('SURYA NEPAL PVT LTD',                              'Simra, Nepal',           27.1583, 84.9800, 5500,   5500*1.3)
ON CONFLICT (name) DO NOTHING;

-- BACKLOADS 
INSERT INTO backloads (description) VALUES
  ('Scrap from Shree Ramchandra Traders Bhairahawa'),
  ('Scrap from Aarush & Abhishree Suppliers'),
  ('Duplex from Arvind Pulp'),
  ('Duplex from Arvind Pulp for Maruti Graphics & MPP'),
  ('Duplex from Arvind Pulp for MPP & Nepal Print'),
  ('Scrap from Hariom Suppliers'),
  ('Scrap from Yeti Distillery Narayanghat'),
  ('Scrap from Chandrika Distillery Rangeli'),
  ('Scrap from Ram Ram Suppliers Pokhara'),
  ('Scrap from Navdurga Pressing'),
  ('Scrap Loaded from Jay Bholenath Traders'),
  ('Scrap Loaded from Krishna Sah Traders'),
  ('Scrap Loaded from Laxmi Ganesh Traders'),
  ('Scrap Loaded from New Shree Ram Chandra Traders'),
  ('Scrap Loaded from Ram Chandra Traders'),
  ('Scrap Loaded from Ram Ram Suppliers'),
  ('Scrap Loaded from Hariom Suppliers'),
  ('Scrap Loaded from Shivam Packaging'),
  ('Scrap Loaded from Jaiswal Traders Gaur'),
  ('Duplex from Arbind Pulp Mills'),
  ('Return Goods from Vikas Food & Saurabh Oil'),
  ('No Backload')
ON CONFLICT (description) DO NOTHING;
