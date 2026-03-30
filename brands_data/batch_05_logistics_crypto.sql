-- Batch 05: Logistics & Crypto (50 brands)

-- LOGISTICS
INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_dhl_com', 'DHL', 'dhl.com', 'logistics', 'curated', '["dhl","dhl express","dhl shipping","dhl tracking"]', '["dh1","dhl-express","dhI"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_fedex_com', 'FedEx', 'fedex.com', 'logistics', 'curated', '["fedex","fed ex","fedex tracking"]', '["f3dex","fed3x","fedx"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ups_com', 'UPS', 'ups.com', 'logistics', 'curated', '["ups","united parcel service","ups tracking"]', '["up5","u-p-s"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_usps_com', 'USPS', 'usps.com', 'logistics', 'curated', '["usps","us postal service","usps tracking"]', '["usp5","us-postal"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_canadapost_postescanada_ca', 'Canada Post', 'canadapost-postescanada.ca', 'logistics', 'curated', '["canada post","postes canada","canada post tracking"]', '["canada-post","canadap0st"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_royalmail_com', 'Royal Mail', 'royalmail.com', 'logistics', 'curated', '["royal mail","royalmail","royal mail tracking"]', '["r0yalmail","royal-mail"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_laposte_fr', 'La Poste', 'laposte.fr', 'logistics', 'curated', '["la poste","laposte","la poste tracking"]', '["la-poste","1aposte"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_deutschepost_de', 'Deutsche Post', 'deutschepost.de', 'logistics', 'curated', '["deutsche post","dhl germany"]', '["deutsche-post"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_tnt_com', 'TNT', 'tnt.com', 'logistics', 'curated', '["tnt","tnt express"]', '["tnt-express"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_maersk_com', 'Maersk', 'maersk.com', 'logistics', 'curated', '["maersk","maersk shipping"]', '["m4ersk","maersk-line"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_purolator_com', 'Purolator', 'purolator.com', 'logistics', 'curated', '["purolator","purolator courier"]', '["purol4tor","puro1ator"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_dpd_com', 'DPD', 'dpd.com', 'logistics', 'curated', '["dpd","dpd parcel","geopost"]', '["d-p-d"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_gls_group_com', 'GLS', 'gls-group.com', 'logistics', 'curated', '["gls","gls parcel"]', '["g1s","gls-group"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_hermes_uk_com', 'Evri', 'evri.com', 'logistics', 'curated', '["evri","hermes","myhermes","evri delivery"]', '["3vri","evr1"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_auspost_com_au', 'Australia Post', 'auspost.com.au', 'logistics', 'curated', '["australia post","auspost"]', '["aus-post","australiapost"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

-- CRYPTO
INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_coinbase_com', 'Coinbase', 'coinbase.com', 'crypto', 'curated', '["coinbase","coinbase login","coinbase wallet"]', '["c0inbase","coinb4se","co1nbase"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_binance_com', 'Binance', 'binance.com', 'crypto', 'curated', '["binance","binance login","bnb"]', '["b1nance","binanc3"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_kraken_com', 'Kraken', 'kraken.com', 'crypto', 'curated', '["kraken","kraken exchange","kraken login"]', '["kr4ken","krak3n"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_gemini_com', 'Gemini', 'gemini.com', 'crypto', 'curated', '["gemini","gemini exchange","gemini login"]', '["gem1ni","gemin1"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_crypto_com', 'Crypto.com', 'crypto.com', 'crypto', 'curated', '["crypto.com","cro","crypto com"]', '["crypt0","crypto-com"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_kucoin_com', 'KuCoin', 'kucoin.com', 'crypto', 'curated', '["kucoin","ku coin","kucoin login"]', '["kuc01n","kuco1n"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_bitfinex_com', 'Bitfinex', 'bitfinex.com', 'crypto', 'curated', '["bitfinex","bitfinex exchange"]', '["b1tfinex","bitf1nex"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_bybit_com', 'Bybit', 'bybit.com', 'crypto', 'curated', '["bybit","bybit exchange","bybit login"]', '["byb1t","byblt"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_okx_com', 'OKX', 'okx.com', 'crypto', 'curated', '["okx","okex","okx exchange"]', '["0kx","okex"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_gate_io', 'Gate.io', 'gate.io', 'crypto', 'curated', '["gate.io","gate io","gate exchange"]', '["gat3io","gate-io"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_uniswap_org', 'Uniswap', 'uniswap.org', 'crypto', 'curated', '["uniswap","uni","uniswap dex"]', '["un1swap","unisw4p"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_metamask_io', 'MetaMask', 'metamask.io', 'crypto', 'curated', '["metamask","meta mask","metamask wallet"]', '["metam4sk","met4mask","meta-mask"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_trustwallet_com', 'Trust Wallet', 'trustwallet.com', 'crypto', 'curated', '["trust wallet","trustwallet"]', '["trustwa11et","trust-wallet"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ledger_com', 'Ledger', 'ledger.com', 'crypto', 'curated', '["ledger","ledger wallet","ledger nano"]', '["l3dger","ledg3r"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_trezor_io', 'Trezor', 'trezor.io', 'crypto', 'curated', '["trezor","trezor wallet"]', '["tr3zor","trez0r"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_opensea_io', 'OpenSea', 'opensea.io', 'crypto', 'curated', '["opensea","open sea","nft marketplace"]', '["0pensea","opens3a"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_phantom_app', 'Phantom', 'phantom.app', 'crypto', 'curated', '["phantom","phantom wallet","solana wallet"]', '["phant0m","ph4ntom"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_blockchain_com', 'Blockchain.com', 'blockchain.com', 'crypto', 'curated', '["blockchain","blockchain wallet","blockchain.com"]', '["bl0ckchain","block-chain"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_nexo_com', 'Nexo', 'nexo.com', 'crypto', 'curated', '["nexo","nexo finance"]', '["n3xo","nex0"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_celsius_network', 'Celsius', 'celsius.network', 'crypto', 'curated', '["celsius","celsius network"]', '["ce1sius","cels1us"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_pancakeswap_finance', 'PancakeSwap', 'pancakeswap.finance', 'crypto', 'curated', '["pancakeswap","pancake swap","cake"]', '["pancakesw4p","pancake-swap"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_aave_com', 'Aave', 'aave.com', 'crypto', 'curated', '["aave","aave finance","aave defi"]', '["a4ve","aav3"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;
