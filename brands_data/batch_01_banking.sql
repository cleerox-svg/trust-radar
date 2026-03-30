-- Batch 01: Banking & Fintech (50 brands)

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_paypal_com', 'PayPal', 'paypal.com', 'banking', 'curated', '["paypal","pay pal","paypal login"]', '["paypa1","paypaI","peypal","paypai"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_chase_com', 'Chase', 'chase.com', 'banking', 'curated', '["chase","chase bank","jpmorgan chase","chase login"]', '["chas3","jp morgan","chase-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_bankofamerica_com', 'Bank of America', 'bankofamerica.com', 'banking', 'curated', '["bank of america","bofa","boa","bankofamerica"]', '["bankofamerica","b0fa","bank-of-america"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_wellsfargo_com', 'Wells Fargo', 'wellsfargo.com', 'banking', 'curated', '["wells fargo","wellsfargo","wf bank"]', '["wells-fargo","we11sfargo","wellsfarg0"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_citi_com', 'Citibank', 'citi.com', 'banking', 'curated', '["citi","citibank","citigroup","citi login"]', '["c1ti","citibank-online","c1tibank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_capitalone_com', 'Capital One', 'capitalone.com', 'banking', 'curated', '["capital one","capitalone","capital one login"]', '["capita1one","capital-one","capit4lone"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_hsbc_com', 'HSBC', 'hsbc.com', 'banking', 'curated', '["hsbc","hsbc bank","hsbc login","hsbc online"]', '["h5bc","hsbc-bank","hSbc"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_barclays_com', 'Barclays', 'barclays.com', 'banking', 'curated', '["barclays","barclays bank","barclays login"]', '["barc1ays","barcIays","barclays-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_santander_com', 'Santander', 'santander.com', 'banking', 'curated', '["santander","santander bank","banco santander"]', '["santand3r","sant4nder","santander-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ing_com', 'ING', 'ing.com', 'banking', 'curated', '["ing","ing bank","ing direct","ing group"]', '["1ng","ing-bank","lng"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_deutschebank_com', 'Deutsche Bank', 'deutschebank.com', 'banking', 'curated', '["deutsche bank","db bank","deutsche"]', '["deutsche-bank","deutschebank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_bnpparibas_com', 'BNP Paribas', 'bnpparibas.com', 'banking', 'curated', '["bnp paribas","bnp","paribas"]', '["bnp-paribas","bnpparibas"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ubs_com', 'UBS', 'ubs.com', 'banking', 'curated', '["ubs","ubs bank","ubs group","credit suisse"]', '["ub5","u8s","ubs-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_rbc_com', 'Royal Bank of Canada', 'rbc.com', 'banking', 'curated', '["rbc","royal bank","royal bank of canada","rbc login"]', '["r8c","rbc-bank","royalbank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_td_com', 'TD Bank', 'td.com', 'banking', 'curated', '["td","td bank","td canada trust","td login"]', '["td-bank","tdbank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_scotiabank_com', 'Scotiabank', 'scotiabank.com', 'banking', 'curated', '["scotiabank","scotia bank","bank of nova scotia"]', '["sc0tiabank","scotia-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_bmo_com', 'BMO', 'bmo.com', 'banking', 'curated', '["bmo","bank of montreal","bmo login"]', '["bm0","bmo-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_cibc_com', 'CIBC', 'cibc.com', 'banking', 'curated', '["cibc","cibc bank","canadian imperial"]', '["c1bc","cibc-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_nbc_ca', 'National Bank of Canada', 'nbc.ca', 'banking', 'curated', '["national bank","nbc","banque nationale"]', '["nbc-bank","nationalbank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_desjardins_com', 'Desjardins', 'desjardins.com', 'banking', 'curated', '["desjardins","caisse desjardins","desjardins login"]', '["desj4rdins","desjardins-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_americanexpress_com', 'American Express', 'americanexpress.com', 'banking', 'curated', '["american express","amex","amex login"]', '["amercanexpress","american-express","am3x"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_visa_com', 'Visa', 'visa.com', 'banking', 'curated', '["visa","visa card","visa login"]', '["v1sa","vlsa","visa-card"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_mastercard_com', 'Mastercard', 'mastercard.com', 'banking', 'curated', '["mastercard","master card","mastercard login"]', '["mast3rcard","masterc4rd","master-card"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_stripe_com', 'Stripe', 'stripe.com', 'banking', 'curated', '["stripe","stripe payments","stripe login"]', '["str1pe","strlpe"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_squareup_com', 'Square', 'squareup.com', 'banking', 'curated', '["square","block","square payments","cash app"]', '["squ4re","square-pay"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_wise_com', 'Wise', 'wise.com', 'banking', 'curated', '["wise","transferwise","wise transfer"]', '["w1se","wlse","transferw1se"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_revolut_com', 'Revolut', 'revolut.com', 'banking', 'curated', '["revolut","revolut bank","revolut login"]', '["rev0lut","revo1ut"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_n26_com', 'N26', 'n26.com', 'banking', 'curated', '["n26","n26 bank","number 26"]', '["n-26","number26"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_venmo_com', 'Venmo', 'venmo.com', 'banking', 'curated', '["venmo","venmo pay","venmo login"]', '["v3nmo","venm0"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_zellepay_com', 'Zelle', 'zellepay.com', 'banking', 'curated', '["zelle","zelle pay","zelle transfer"]', '["ze11e","zel1e","zelle-pay"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_cash_app', 'Cash App', 'cash.app', 'banking', 'curated', '["cash app","cashapp","cash app login"]', '["c4shapp","cash-app","cashap"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_klarna_com', 'Klarna', 'klarna.com', 'banking', 'curated', '["klarna","klarna pay","buy now pay later"]', '["k1arna","klarn4"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_affirm_com', 'Affirm', 'affirm.com', 'banking', 'curated', '["affirm","affirm pay","affirm login"]', '["aff1rm","4ffirm"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_sofi_com', 'SoFi', 'sofi.com', 'banking', 'curated', '["sofi","sofi bank","sofi login"]', '["s0fi","sof1"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_chime_com', 'Chime', 'chime.com', 'banking', 'curated', '["chime","chime bank","chime login"]', '["ch1me","chlme"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ally_com', 'Ally Bank', 'ally.com', 'banking', 'curated', '["ally","ally bank","ally financial"]', '["a11y","ally-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_usbank_com', 'U.S. Bank', 'usbank.com', 'banking', 'curated', '["us bank","usbank","u.s. bank"]', '["us-bank","usb4nk"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_pnc_com', 'PNC Bank', 'pnc.com', 'banking', 'curated', '["pnc","pnc bank","pnc financial"]', '["pnc-bank","pnc8ank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_truist_com', 'Truist', 'truist.com', 'banking', 'curated', '["truist","truist bank","suntrust","bb&t"]', '["tru1st","truist-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_discover_com', 'Discover', 'discover.com', 'banking', 'curated', '["discover","discover card","discover bank"]', '["disc0ver","dlscover"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_goldmansachs_com', 'Goldman Sachs', 'goldmansachs.com', 'banking', 'curated', '["goldman sachs","goldman","marcus","gs bank"]', '["go1dmansachs","goldman-sachs"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_morganstanley_com', 'Morgan Stanley', 'morganstanley.com', 'banking', 'curated', '["morgan stanley","etrade","morgan stanley login"]', '["morgan-stanley","m0rganstanley"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_schwab_com', 'Charles Schwab', 'schwab.com', 'banking', 'curated', '["schwab","charles schwab","schwab login"]', '["schw4b","schwab-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_fidelity_com', 'Fidelity', 'fidelity.com', 'banking', 'curated', '["fidelity","fidelity investments","fidelity login"]', '["fide1ity","fldelity"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_robinhood_com', 'Robinhood', 'robinhood.com', 'banking', 'curated', '["robinhood","robinhood app","robinhood login"]', '["r0binhood","rob1nhood"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_etoro_com', 'eToro', 'etoro.com', 'banking', 'curated', '["etoro","etoro trading","etoro login"]', '["et0ro","etor0"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_standardchartered_com', 'Standard Chartered', 'sc.com', 'banking', 'curated', '["standard chartered","sc bank","stanchart"]', '["standard-chartered","standardchartered"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_commbank_com_au', 'Commonwealth Bank', 'commbank.com.au', 'banking', 'curated', '["commbank","commonwealth bank","cba"]', '["comm-bank","commonwea1th"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_westpac_com_au', 'Westpac', 'westpac.com.au', 'banking', 'curated', '["westpac","westpac bank"]', '["w3stpac","westpac-bank"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;
