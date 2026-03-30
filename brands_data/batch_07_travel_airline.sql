-- Batch 07: Airlines & Travel (45 brands)

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_united_com', 'United Airlines', 'united.com', 'travel', 'curated', '["united airlines","united","united login"]', '["un1ted","united-airlines"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_delta_com', 'Delta Air Lines', 'delta.com', 'travel', 'curated', '["delta","delta airlines","delta login"]', '["de1ta","d3lta"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_aa_com', 'American Airlines', 'aa.com', 'travel', 'curated', '["american airlines","aa","american air"]', '["amer1can-airlines","aa-com"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_southwest_com', 'Southwest Airlines', 'southwest.com', 'travel', 'curated', '["southwest","southwest airlines","southwest login"]', '["s0uthwest","southwest-air"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_aircanada_com', 'Air Canada', 'aircanada.com', 'travel', 'curated', '["air canada","aircanada","air canada login"]', '["a1rcanada","air-canada"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_westjet_com', 'WestJet', 'westjet.com', 'travel', 'curated', '["westjet","west jet"]', '["w3stjet","west-jet"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_britishairways_com', 'British Airways', 'britishairways.com', 'travel', 'curated', '["british airways","ba","british air"]', '["brit1shairways","british-airways"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_lufthansa_com', 'Lufthansa', 'lufthansa.com', 'travel', 'curated', '["lufthansa","lufthansa airlines"]', '["1ufthansa","lufth4nsa"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_emirates_com', 'Emirates', 'emirates.com', 'travel', 'curated', '["emirates","emirates airline","fly emirates"]', '["em1rates","emir4tes"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_qantas_com', 'Qantas', 'qantas.com', 'travel', 'curated', '["qantas","qantas airlines"]', '["q4ntas","qant4s"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ryanair_com', 'Ryanair', 'ryanair.com', 'travel', 'curated', '["ryanair","ryan air"]', '["ryan4ir","ryanar"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_easyjet_com', 'easyJet', 'easyjet.com', 'travel', 'curated', '["easyjet","easy jet"]', '["e4syjet","easy-jet"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_jetblue_com', 'JetBlue', 'jetblue.com', 'travel', 'curated', '["jetblue","jet blue"]', '["j3tblue","jetb1ue"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_alaskaair_com', 'Alaska Airlines', 'alaskaair.com', 'travel', 'curated', '["alaska airlines","alaska air"]', '["a1askaair","alaska-airlines"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_singaporeair_com', 'Singapore Airlines', 'singaporeair.com', 'travel', 'curated', '["singapore airlines","sia","sq"]', '["singapore-airlines"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_booking_com', 'Booking.com', 'booking.com', 'travel', 'curated', '["booking.com","booking","book hotel"]', '["b00king","bookng","booking-com"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_expedia_com', 'Expedia', 'expedia.com', 'travel', 'curated', '["expedia","expedia travel","expedia login"]', '["exped1a","exp3dia"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_airbnb_com', 'Airbnb', 'airbnb.com', 'travel', 'curated', '["airbnb","air bnb","airbnb login"]', '["a1rbnb","airbnb-com"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_marriott_com', 'Marriott', 'marriott.com', 'travel', 'curated', '["marriott","marriott hotel","marriott login","bonvoy"]', '["marr1ott","marri0tt"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_hilton_com', 'Hilton', 'hilton.com', 'travel', 'curated', '["hilton","hilton hotel","hilton honors","hilton login"]', '["h1lton","hilt0n"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ihg_com', 'IHG', 'ihg.com', 'travel', 'curated', '["ihg","intercontinental","holiday inn","ihg login"]', '["1hg","ihg-hotels"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_hyatt_com', 'Hyatt', 'hyatt.com', 'travel', 'curated', '["hyatt","hyatt hotel","hyatt login"]', '["hy4tt","hyat"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_tripadvisor_com', 'Tripadvisor', 'tripadvisor.com', 'travel', 'curated', '["tripadvisor","trip advisor"]', '["tr1padvisor","trip-advisor"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_kayak_com', 'Kayak', 'kayak.com', 'travel', 'curated', '["kayak","kayak travel"]', '["k4yak","kayak-travel"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_vrbo_com', 'Vrbo', 'vrbo.com', 'travel', 'curated', '["vrbo","vacation rental by owner"]', '["vrb0","vr8o"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_uber_com', 'Uber', 'uber.com', 'travel', 'curated', '["uber","uber ride","uber eats","uber login"]', '["ub3r","uber-com"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_lyft_com', 'Lyft', 'lyft.com', 'travel', 'curated', '["lyft","lyft ride","lyft login"]', '["1yft","lyf7"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_doordash_com', 'DoorDash', 'doordash.com', 'ecommerce', 'curated', '["doordash","door dash","doordash login"]', '["d00rdash","doord4sh"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_grubhub_com', 'Grubhub', 'grubhub.com', 'ecommerce', 'curated', '["grubhub","grub hub"]', '["grubh0b","grub-hub"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_instacart_com', 'Instacart', 'instacart.com', 'ecommerce', 'curated', '["instacart","insta cart"]', '["1nstacart","instac4rt"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;
