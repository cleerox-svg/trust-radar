-- Batch 06: Government & Telecom (50 brands)

-- GOVERNMENT
INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_irs_gov', 'IRS', 'irs.gov', 'government', 'curated', '["irs","internal revenue service","irs refund","irs login"]', '["1rs","irs-gov"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_canada_ca', 'Canada Revenue Agency', 'canada.ca', 'government', 'curated', '["cra","canada revenue","canada.ca","government of canada"]', '["cra-arc","canada-revenue"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_gov_uk', 'HMRC', 'gov.uk', 'government', 'curated', '["hmrc","gov.uk","uk government","tax uk"]', '["hmrc-gov","gov-uk"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ato_gov_au', 'ATO', 'ato.gov.au', 'government', 'curated', '["ato","australian taxation office","ato login"]', '["at0","ato-gov"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ssa_gov', 'Social Security Administration', 'ssa.gov', 'government', 'curated', '["ssa","social security","social security login"]', '["ss4","ssa-gov"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_medicare_gov', 'Medicare', 'medicare.gov', 'government', 'curated', '["medicare","medicare login","cms"]', '["med1care","medicare-gov"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_va_gov', 'Department of Veterans Affairs', 'va.gov', 'government', 'curated', '["va","veterans affairs","va login","va benefits"]', '["v4","va-gov"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_fema_gov', 'FEMA', 'fema.gov', 'government', 'curated', '["fema","federal emergency","fema login"]', '["f3ma","fema-gov"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_login_gov', 'Login.gov', 'login.gov', 'government', 'curated', '["login.gov","login gov","us government login"]', '["log1n-gov","login-gov"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_usajobs_gov', 'USAJobs', 'usajobs.gov', 'government', 'curated', '["usajobs","usa jobs","government jobs"]', '["usa-jobs","usaj0bs"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_service_canada_ca', 'Service Canada', 'servicecanada.gc.ca', 'government', 'curated', '["service canada","ei","employment insurance"]', '["service-canada"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_nhs_uk', 'NHS', 'nhs.uk', 'government', 'curated', '["nhs","national health service","nhs login"]', '["nh5","nhs-uk"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_mygov_au', 'myGov', 'my.gov.au', 'government', 'curated', '["mygov","my gov","australian government"]', '["myg0v","my-gov"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

-- TELECOM
INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_att_com', 'AT&T', 'att.com', 'telecom', 'curated', '["at&t","att","at and t","att login"]', '["4tt","at-t","a7t"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_verizon_com', 'Verizon', 'verizon.com', 'telecom', 'curated', '["verizon","verizon wireless","verizon login"]', '["ver1zon","veriz0n"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_t_mobile_com', 'T-Mobile', 't-mobile.com', 'telecom', 'curated', '["t-mobile","tmobile","t mobile login"]', '["t-mob1le","tm0bile"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_rogers_com', 'Rogers', 'rogers.com', 'telecom', 'curated', '["rogers","rogers wireless","rogers login"]', '["r0gers","rog3rs"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_bell_ca', 'Bell', 'bell.ca', 'telecom', 'curated', '["bell","bell canada","bell login"]', '["be11","b3ll"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_telus_com', 'Telus', 'telus.com', 'telecom', 'curated', '["telus","telus mobility","telus login"]', '["te1us","t3lus"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_vodafone_com', 'Vodafone', 'vodafone.com', 'telecom', 'curated', '["vodafone","vodafone login"]', '["v0dafone","vodaf0ne"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_orange_com', 'Orange', 'orange.com', 'telecom', 'curated', '["orange","orange telecom"]', '["0range","orang3"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_bt_com', 'BT', 'bt.com', 'telecom', 'curated', '["bt","british telecom","bt login"]', '["b-t","btgroup"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ee_co_uk', 'EE', 'ee.co.uk', 'telecom', 'curated', '["ee","ee mobile","everything everywhere"]', '["3e","e-e"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_o2_co_uk', 'O2', 'o2.co.uk', 'telecom', 'curated', '["o2","o2 mobile"]', '["02","o-2"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_telekom_com', 'Deutsche Telekom', 'telekom.com', 'telecom', 'curated', '["deutsche telekom","telekom","t-systems"]', '["te1ekom","deut5che-telekom"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_telefonica_com', 'Telefonica', 'telefonica.com', 'telecom', 'curated', '["telefonica","movistar","o2 spain"]', '["telef0nica","telefon1ca"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_comcast_com', 'Comcast', 'comcast.com', 'telecom', 'curated', '["comcast","xfinity","comcast login"]', '["c0mcast","comca5t"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_xfinity_com', 'Xfinity', 'xfinity.com', 'telecom', 'curated', '["xfinity","xfinity login","xfinity wifi"]', '["xfin1ty","xf1nity"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_spectrum_com', 'Spectrum', 'spectrum.com', 'telecom', 'curated', '["spectrum","charter spectrum","spectrum login"]', '["sp3ctrum","spectr0m"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_cox_com', 'Cox Communications', 'cox.com', 'telecom', 'curated', '["cox","cox communications","cox login"]', '["c0x"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_three_co_uk', 'Three', 'three.co.uk', 'telecom', 'curated', '["three","three mobile","3 mobile"]', '["thr3e","thre3"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_sky_com', 'Sky', 'sky.com', 'telecom', 'curated', '["sky","sky broadband","sky login"]', '["5ky","sk7"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_singtel_com', 'Singtel', 'singtel.com', 'telecom', 'curated', '["singtel","singapore telecom"]', '["s1ngtel","singt3l"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_optus_com_au', 'Optus', 'optus.com.au', 'telecom', 'curated', '["optus","optus mobile"]', '["0ptus","optu5"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_telstra_com_au', 'Telstra', 'telstra.com.au', 'telecom', 'curated', '["telstra","telstra mobile"]', '["te1stra","t3lstra"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;
