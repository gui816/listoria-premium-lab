-- International country and supermarket catalogue for Listora basket estimates.
-- Publicly readable reference data; writes remain restricted to database administrators.

create table if not exists public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  flag_emoji text not null default '',
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  currency_locale text not null,
  default_language text not null,
  enabled boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.supermarkets (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete cascade,
  name text not null,
  slug text not null,
  website text,
  price_position text not null default 'mid'
    check (price_position in ('budget','mid','premium','mixed')),
  enabled boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (country_code, slug)
);

create index if not exists supermarkets_country_enabled_order_idx
  on public.supermarkets(country_code, enabled, display_order);

alter table public.countries enable row level security;
alter table public.supermarkets enable row level security;
revoke all on public.countries from anon, authenticated;
revoke all on public.supermarkets from anon, authenticated;
grant select on public.countries to anon, authenticated;
grant select on public.supermarkets to anon, authenticated;

drop policy if exists "Enabled countries are publicly readable" on public.countries;
create policy "Enabled countries are publicly readable"
  on public.countries for select to anon, authenticated
  using (enabled = true);

drop policy if exists "Enabled supermarkets are publicly readable" on public.supermarkets;
create policy "Enabled supermarkets are publicly readable"
  on public.supermarkets for select to anon, authenticated
  using (enabled = true);

insert into public.countries (code,name,flag_emoji,currency_code,currency_locale,default_language,display_order)
values
('PT','Portugal','🇵🇹','EUR','pt-PT','pt-PT',1),
('ES','Espanha','🇪🇸','EUR','es-ES','es',2),
('FR','França','🇫🇷','EUR','fr-FR','fr',3),
('DE','Alemanha','🇩🇪','EUR','de-DE','de',4),
('IT','Itália','🇮🇹','EUR','it-IT','it',5),
('GB','Reino Unido','🇬🇧','GBP','en-GB','en',6),
('IE','Irlanda','🇮🇪','EUR','en-IE','en',7),
('NL','Países Baixos','🇳🇱','EUR','nl-NL','nl',8),
('BE','Bélgica','🇧🇪','EUR','nl-BE','nl',9),
('LU','Luxemburgo','🇱🇺','EUR','fr-LU','fr',10),
('CH','Suíça','🇨🇭','CHF','de-CH','de',11),
('AT','Áustria','🇦🇹','EUR','de-AT','de',12),
('DK','Dinamarca','🇩🇰','DKK','da-DK','da',13),
('SE','Suécia','🇸🇪','SEK','sv-SE','sv',14),
('NO','Noruega','🇳🇴','NOK','nb-NO','nb',15),
('FI','Finlândia','🇫🇮','EUR','fi-FI','fi',16),
('IS','Islândia','🇮🇸','ISK','is-IS','is',17),
('PL','Polónia','🇵🇱','PLN','pl-PL','pl',18),
('CZ','Chéquia','🇨🇿','CZK','cs-CZ','cs',19),
('SK','Eslováquia','🇸🇰','EUR','sk-SK','sk',20),
('HU','Hungria','🇭🇺','HUF','hu-HU','hu',21),
('RO','Roménia','🇷🇴','RON','ro-RO','ro',22),
('BG','Bulgária','🇧🇬','EUR','bg-BG','bg',23),
('GR','Grécia','🇬🇷','EUR','el-GR','el',24),
('HR','Croácia','🇭🇷','EUR','hr-HR','hr',25),
('SI','Eslovénia','🇸🇮','EUR','sl-SI','sl',26),
('RS','Sérvia','🇷🇸','RSD','sr-RS','sr',27),
('BA','Bósnia e Herzegovina','🇧🇦','BAM','bs-BA','bs',28),
('ME','Montenegro','🇲🇪','EUR','sr-ME','sr',29),
('MK','Macedónia do Norte','🇲🇰','MKD','mk-MK','mk',30),
('AL','Albânia','🇦🇱','ALL','sq-AL','sq',31),
('XK','Kosovo','🇽🇰','EUR','sq-XK','sq',32),
('MD','Moldávia','🇲🇩','MDL','ro-MD','ro',33),
('UA','Ucrânia','🇺🇦','UAH','uk-UA','uk',34),
('BY','Bielorrússia','🇧🇾','BYN','be-BY','be',35),
('RU','Rússia','🇷🇺','RUB','ru-RU','ru',36),
('TR','Turquia','🇹🇷','TRY','tr-TR','tr',37),
('CY','Chipre','🇨🇾','EUR','el-CY','el',38),
('MT','Malta','🇲🇹','EUR','en-MT','en',39),
('EE','Estónia','🇪🇪','EUR','et-EE','et',40),
('LV','Letónia','🇱🇻','EUR','lv-LV','lv',41),
('LT','Lituânia','🇱🇹','EUR','lt-LT','lt',42),
('AD','Andorra','🇦🇩','EUR','ca-AD','ca',43),
('MC','Mónaco','🇲🇨','EUR','fr-MC','fr',44),
('SM','São Marino','🇸🇲','EUR','it-SM','it',45),
('LI','Liechtenstein','🇱🇮','CHF','de-LI','de',46),
('VA','Vaticano','🇻🇦','EUR','it-VA','it',47),
('BR','Brasil','🇧🇷','BRL','pt-BR','pt-BR',100),
('AR','Argentina','🇦🇷','ARS','es-AR','es',101),
('CL','Chile','🇨🇱','CLP','es-CL','es',102),
('CO','Colômbia','🇨🇴','COP','es-CO','es',103),
('PE','Peru','🇵🇪','PEN','es-PE','es',104),
('UY','Uruguai','🇺🇾','UYU','es-UY','es',105),
('PY','Paraguai','🇵🇾','PYG','es-PY','es',106),
('EC','Equador','🇪🇨','USD','es-EC','es',107),
('BO','Bolívia','🇧🇴','BOB','es-BO','es',108),
('VE','Venezuela','🇻🇪','VES','es-VE','es',109),
('GY','Guiana','🇬🇾','GYD','en-GY','en',110),
('SR','Suriname','🇸🇷','SRD','nl-SR','nl',111),
('US','Estados Unidos','🇺🇸','USD','en-US','en',200),
('CA','Canadá','🇨🇦','CAD','en-CA','en',201)
on conflict (code) do update set
  name=excluded.name, flag_emoji=excluded.flag_emoji, currency_code=excluded.currency_code,
  currency_locale=excluded.currency_locale, default_language=excluded.default_language,
  display_order=excluded.display_order;

insert into public.supermarkets (country_code,name,slug,website,price_position,display_order)
values
-- Portugal
('PT','Continente','continente','https://www.continente.pt','mid',1),('PT','Pingo Doce','pingo-doce','https://www.pingodoce.pt','mid',2),('PT','Lidl','lidl','https://www.lidl.pt','budget',3),('PT','Mercadona','mercadona','https://www.mercadona.pt','mid',4),('PT','Auchan','auchan','https://www.auchan.pt','mid',5),('PT','Aldi','aldi','https://www.aldi.pt','budget',6),('PT','Intermarché','intermarche','https://www.intermarche.pt','mid',7),
-- Spain
('ES','Mercadona','mercadona','https://www.mercadona.es','mid',1),('ES','Carrefour','carrefour','https://www.carrefour.es','mid',2),('ES','Lidl','lidl','https://www.lidl.es','budget',3),('ES','DIA','dia','https://www.dia.es','budget',4),('ES','Eroski','eroski','https://www.eroski.es','mid',5),('ES','Alcampo','alcampo','https://www.compraonline.alcampo.es','mid',6),('ES','Consum','consum','https://www.consum.es','mid',7),
-- France
('FR','Carrefour','carrefour','https://www.carrefour.fr','mid',1),('FR','E.Leclerc','e-leclerc','https://www.e.leclerc','budget',2),('FR','Intermarché','intermarche','https://www.intermarche.com','mid',3),('FR','Super U','super-u','https://www.magasins-u.com','mid',4),('FR','Lidl','lidl','https://www.lidl.fr','budget',5),('FR','Auchan','auchan','https://www.auchan.fr','mid',6),('FR','Aldi','aldi','https://www.aldi.fr','budget',7),
-- Germany
('DE','Edeka','edeka','https://www.edeka.de','mid',1),('DE','REWE','rewe','https://www.rewe.de','mid',2),('DE','Aldi','aldi','https://www.aldi.de','budget',3),('DE','Lidl','lidl','https://www.lidl.de','budget',4),('DE','Kaufland','kaufland','https://www.kaufland.de','mid',5),('DE','Netto','netto','https://www.netto-online.de','budget',6),('DE','Penny','penny','https://www.penny.de','budget',7),
-- Italy
('IT','Conad','conad','https://www.conad.it','mid',1),('IT','Coop','coop','https://www.coop.it','mid',2),('IT','Esselunga','esselunga','https://www.esselunga.it','premium',3),('IT','Eurospin','eurospin','https://www.eurospin.it','budget',4),('IT','Lidl','lidl','https://www.lidl.it','budget',5),('IT','Carrefour','carrefour','https://www.carrefour.it','mid',6),('IT','Despar','despar','https://www.despar.it','mid',7),
-- United Kingdom and Ireland
('GB','Tesco','tesco','https://www.tesco.com','mid',1),('GB','Sainsbury''s','sainsburys','https://www.sainsburys.co.uk','mid',2),('GB','Asda','asda','https://www.asda.com','budget',3),('GB','Aldi','aldi','https://www.aldi.co.uk','budget',4),('GB','Lidl','lidl','https://www.lidl.co.uk','budget',5),('GB','Morrisons','morrisons','https://www.morrisons.com','mid',6),('GB','Waitrose','waitrose','https://www.waitrose.com','premium',7),
('IE','Tesco','tesco','https://www.tesco.ie','mid',1),('IE','Dunnes Stores','dunnes-stores','https://www.dunnesstores.com','mid',2),('IE','SuperValu','supervalu','https://supervalu.ie','mid',3),('IE','Lidl','lidl','https://www.lidl.ie','budget',4),('IE','Aldi','aldi','https://www.aldi.ie','budget',5),
-- Netherlands, Belgium, Luxembourg
('NL','Albert Heijn','albert-heijn','https://www.ah.nl','mid',1),('NL','Jumbo','jumbo','https://www.jumbo.com','mid',2),('NL','Lidl','lidl','https://www.lidl.nl','budget',3),('NL','Aldi','aldi','https://www.aldi.nl','budget',4),('NL','PLUS','plus','https://www.plus.nl','mid',5),('NL','Dirk','dirk','https://www.dirk.nl','budget',6),
('BE','Colruyt','colruyt','https://www.colruyt.be','budget',1),('BE','Delhaize','delhaize','https://www.delhaize.be','mid',2),('BE','Carrefour','carrefour','https://www.carrefour.be','mid',3),('BE','Aldi','aldi','https://www.aldi.be','budget',4),('BE','Lidl','lidl','https://www.lidl.be','budget',5),('BE','Albert Heijn','albert-heijn','https://www.ah.be','mid',6),
('LU','Cactus','cactus','https://www.cactus.lu','mid',1),('LU','Delhaize','delhaize','https://www.delhaize.lu','mid',2),('LU','Auchan','auchan','https://www.auchan.lu','mid',3),('LU','Lidl','lidl','https://www.lidl.lu','budget',4),('LU','Aldi','aldi','https://www.aldi.lu','budget',5),
-- Switzerland, Austria, Nordics
('CH','Migros','migros','https://www.migros.ch','mid',1),('CH','Coop','coop','https://www.coop.ch','mid',2),('CH','Denner','denner','https://www.denner.ch','budget',3),('CH','Aldi','aldi','https://www.aldi.ch','budget',4),('CH','Lidl','lidl','https://www.lidl.ch','budget',5),
('AT','Spar','spar','https://www.spar.at','mid',1),('AT','Billa','billa','https://www.billa.at','mid',2),('AT','Hofer','hofer','https://www.hofer.at','budget',3),('AT','Lidl','lidl','https://www.lidl.at','budget',4),('AT','Penny','penny','https://www.penny.at','budget',5),
('DK','Netto','netto','https://www.netto.dk','budget',1),('DK','REMA 1000','rema-1000','https://www.rema1000.dk','budget',2),('DK','føtex','fotex','https://www.foetex.dk','mid',3),('DK','Bilka','bilka','https://www.bilka.dk','mid',4),('DK','Lidl','lidl','https://www.lidl.dk','budget',5),
('SE','ICA','ica','https://www.ica.se','mid',1),('SE','Coop','coop','https://www.coop.se','mid',2),('SE','Willys','willys','https://www.willys.se','budget',3),('SE','Hemköp','hemkop','https://www.hemkop.se','mid',4),('SE','Lidl','lidl','https://www.lidl.se','budget',5),
('NO','REMA 1000','rema-1000','https://www.rema.no','budget',1),('NO','Kiwi','kiwi','https://kiwi.no','budget',2),('NO','Coop','coop','https://www.coop.no','mid',3),('NO','Meny','meny','https://meny.no','premium',4),('NO','Spar','spar','https://spar.no','mid',5),
('FI','S-market','s-market','https://www.s-kaupat.fi','mid',1),('FI','Prisma','prisma','https://www.s-kaupat.fi','mid',2),('FI','K-Citymarket','k-citymarket','https://www.k-ruoka.fi','mid',3),('FI','K-Supermarket','k-supermarket','https://www.k-ruoka.fi','mid',4),('FI','Lidl','lidl','https://www.lidl.fi','budget',5),
-- Central and Eastern Europe
('PL','Biedronka','biedronka','https://www.biedronka.pl','budget',1),('PL','Lidl','lidl','https://www.lidl.pl','budget',2),('PL','Dino','dino','https://marketdino.pl','mid',3),('PL','Kaufland','kaufland','https://www.kaufland.pl','mid',4),('PL','Carrefour','carrefour','https://www.carrefour.pl','mid',5),('PL','Aldi','aldi','https://www.aldi.pl','budget',6),
('CZ','Albert','albert','https://www.albert.cz','mid',1),('CZ','Lidl','lidl','https://www.lidl.cz','budget',2),('CZ','Kaufland','kaufland','https://www.kaufland.cz','mid',3),('CZ','Penny','penny','https://www.penny.cz','budget',4),('CZ','Billa','billa','https://www.billa.cz','mid',5),
('SK','Lidl','lidl','https://www.lidl.sk','budget',1),('SK','Kaufland','kaufland','https://www.kaufland.sk','mid',2),('SK','Tesco','tesco','https://www.tesco.sk','mid',3),('SK','Billa','billa','https://www.billa.sk','mid',4),('SK','COOP Jednota','coop-jednota','https://www.coop.sk','mid',5),
('HU','Lidl','lidl','https://www.lidl.hu','budget',1),('HU','Aldi','aldi','https://www.aldi.hu','budget',2),('HU','Tesco','tesco','https://www.tesco.hu','mid',3),('HU','Spar','spar','https://www.spar.hu','mid',4),('HU','Penny','penny','https://www.penny.hu','budget',5),
('RO','Lidl','lidl','https://www.lidl.ro','budget',1),('RO','Kaufland','kaufland','https://www.kaufland.ro','mid',2),('RO','Carrefour','carrefour','https://www.carrefour.ro','mid',3),('RO','Mega Image','mega-image','https://www.mega-image.ro','mid',4),('RO','Profi','profi','https://www.profi.ro','mid',5),('RO','Penny','penny','https://www.penny.ro','budget',6),
('BG','Kaufland','kaufland','https://www.kaufland.bg','mid',1),('BG','Lidl','lidl','https://www.lidl.bg','budget',2),('BG','Billa','billa','https://www.billa.bg','mid',3),('BG','Fantastico','fantastico','https://www.fantastico.bg','mid',4),
('GR','Sklavenitis','sklavenitis','https://www.sklavenitis.gr','mid',1),('GR','AB Vassilopoulos','ab-vassilopoulos','https://www.ab.gr','mid',2),('GR','Lidl','lidl','https://www.lidl.gr','budget',3),('GR','My market','my-market','https://www.mymarket.gr','mid',4),('GR','Masoutis','masoutis','https://www.masoutis.gr','mid',5),
('HR','Konzum','konzum','https://www.konzum.hr','mid',1),('HR','Lidl','lidl','https://www.lidl.hr','budget',2),('HR','Spar','spar','https://www.spar.hr','mid',3),('HR','Kaufland','kaufland','https://www.kaufland.hr','mid',4),('HR','Plodine','plodine','https://www.plodine.hr','mid',5),
('SI','Mercator','mercator','https://www.mercator.si','mid',1),('SI','Spar','spar','https://www.spar.si','mid',2),('SI','Hofer','hofer','https://www.hofer.si','budget',3),('SI','Lidl','lidl','https://www.lidl.si','budget',4),('SI','Tuš','tus','https://www.tus.si','mid',5),
('RS','Maxi','maxi','https://www.maxi.rs','mid',1),('RS','Idea','idea','https://www.idea.rs','mid',2),('RS','Lidl','lidl','https://www.lidl.rs','budget',3),('RS','Univerexport','univerexport','https://www.univerexport.rs','mid',4),
('BA','Bingo','bingo','https://www.bingotuzla.ba','mid',1),('BA','Konzum','konzum','https://www.konzum.co.ba','mid',2),('BA','Tropic','tropic','https://tropic.ba','mid',3),
('ME','Voli','voli','https://voli.me','mid',1),('ME','HDL','hdl','https://hdl365.me','mid',2),('ME','Aroma','aroma','https://aroma.co.me','mid',3),
('MK','Vero','vero','https://vero.com.mk','mid',1),('MK','Tinex','tinex','https://tinex.com.mk','mid',2),('MK','KAM','kam.com.mk','https://kam.com.mk','budget',3),
('AL','SPAR','spar','https://www.spar.al','mid',1),('AL','Big Market','big-market','https://bigmarket.al','mid',2),('AL','Conad','conad','https://www.conad.al','mid',3),
('XK','Viva Fresh','viva-fresh','https://vivafresh-rks.com','mid',1),('XK','ETC','etc','https://etc-ks.com','mid',2),('XK','Meridian Express','meridian-express','https://meridianexpress.com','mid',3),
('MD','Linella','linella','https://linella.md','mid',1),('MD','Kaufland','kaufland','https://www.kaufland.md','mid',2),('MD','Nr.1','nr-1','https://nr1.md','mid',3),
('UA','ATB','atb','https://www.atbmarket.com','budget',1),('UA','Silpo','silpo','https://silpo.ua','mid',2),('UA','Novus','novus.ua','https://novus.ua','mid',3),('UA','Varus','varus','https://varus.ua','mid',4),
('BY','Euroopt','euroopt','https://euroopt.by','mid',1),('BY','Gippo','gippo.by','https://gippo.by','mid',2),('BY','Korona','korona.by','https://korona.by','mid',3),
('RU','Pyaterochka','pyaterochka','https://5ka.ru','budget',1),('RU','Magnit','magnit','https://magnit.ru','mid',2),('RU','Lenta','lenta','https://lenta.com','mid',3),('RU','Perekrestok','perekrestok','https://www.perekrestok.ru','premium',4),
('TR','Migros','migros','https://www.migros.com.tr','mid',1),('TR','CarrefourSA','carrefoursa','https://www.carrefoursa.com','mid',2),('TR','A101','a101','https://www.a101.com.tr','budget',3),('TR','BİM','bim','https://www.bim.com.tr','budget',4),('TR','Şok','sok','https://www.sokmarket.com.tr','budget',5),
('CY','Alphamega','alphamega','https://www.alphamega.com.cy','mid',1),('CY','Lidl','lidl','https://www.lidl.com.cy','budget',2),('CY','Sklavenitis','sklavenitis','https://www.sklavenitis.com.cy','mid',3),
('MT','Welbee''s','welbees','https://www.welbees.com','mid',1),('MT','Pavi','pavi','https://pavi.com.mt','mid',2),('MT','Lidl','lidl','https://www.lidl.com.mt','budget',3),('MT','Greens','greens','https://greens.com.mt','premium',4),
('EE','Selver','selver','https://www.selver.ee','mid',1),('EE','Rimi','rimi','https://www.rimi.ee','mid',2),('EE','Coop','coop','https://www.coop.ee','mid',3),('EE','Maxima','maxima','https://www.maxima.ee','mid',4),('EE','Lidl','lidl','https://www.lidl.ee','budget',5),
('LV','Rimi','rimi','https://www.rimi.lv','mid',1),('LV','Maxima','maxima','https://www.maxima.lv','mid',2),('LV','Lidl','lidl','https://www.lidl.lv','budget',3),('LV','Elvi','elvi','https://elvi.lv','mid',4),('LV','Mego','mego','https://mego.lv','mid',5),
('LT','Maxima','maxima','https://www.maxima.lt','mid',1),('LT','Iki','iki','https://iki.lt','mid',2),('LT','Lidl','lidl','https://www.lidl.lt','budget',3),('LT','Rimi','rimi','https://www.rimi.lt','mid',4),('LT','Norfa','norfa','https://www.norfa.lt','mid',5),
-- Microstates and small European markets
('AD','Andorra 2000','andorra-2000','https://www.andorra2000.ad','mid',1),('AD','Carrefour','carrefour','https://www.carrefour.es','mid',2),
('MC','Carrefour','carrefour','https://www.carrefour.fr','mid',1),('MC','Casino','casino','https://www.casino.fr','mid',2),
('SM','Conad','conad','https://www.conad.it','mid',1),
('LI','Coop','coop','https://www.coop.ch','mid',1),('LI','Migros','migros','https://www.migros.ch','mid',2),
('VA','Carrefour','carrefour','https://www.carrefour.it','mid',1),('VA','Conad','conad','https://www.conad.it','mid',2),
-- South America
('BR','Carrefour','carrefour','https://www.carrefour.com.br','mid',1),('BR','Assaí','assai','https://www.assai.com.br','budget',2),('BR','Atacadão','atacadao','https://www.atacadao.com.br','budget',3),('BR','Pão de Açúcar','pao-de-acucar','https://www.paodeacucar.com','premium',4),('BR','Grupo Mateus','grupo-mateus','https://www.grupomateus.com.br','mid',5),('BR','Supermercados BH','supermercados-bh','https://www.supermercadosbh.com.br','mid',6),
('AR','Carrefour','carrefour','https://www.carrefour.com.ar','mid',1),('AR','Coto','coto','https://www.coto.com.ar','mid',2),('AR','Día','dia','https://diaonline.supermercadosdia.com.ar','budget',3),('AR','Jumbo','jumbo','https://www.jumbo.com.ar','premium',4),('AR','La Anónima','la-anonima','https://www.laanonima.com.ar','mid',5),
('CL','Lider','lider','https://www.lider.cl','budget',1),('CL','Jumbo','jumbo','https://www.jumbo.cl','premium',2),('CL','Santa Isabel','santa-isabel','https://www.santaisabel.cl','mid',3),('CL','Unimarc','unimarc','https://www.unimarc.cl','mid',4),('CL','Tottus','tottus','https://www.tottus.cl','mid',5),
('CO','Éxito','exito','https://www.exito.com','mid',1),('CO','Carulla','carulla','https://www.carulla.com','premium',2),('CO','Olímpica','olimpica','https://www.olimpica.com','mid',3),('CO','D1','d1','https://www.tiendasd1.com','budget',4),('CO','Ara','ara','https://www.tiendasara.com','budget',5),('CO','Jumbo','jumbo','https://www.tiendasjumbo.co','mid',6),
('PE','Plaza Vea','plaza-vea','https://www.plazavea.com.pe','mid',1),('PE','Wong','wong','https://www.wong.pe','premium',2),('PE','Metro','metro','https://www.metro.pe','mid',3),('PE','Tottus','tottus','https://www.tottus.com.pe','mid',4),('PE','Mass','mass','https://www.mass.com.pe','budget',5),('PE','Makro','makro','https://www.makro.com.pe','budget',6),
('UY','Ta-Ta','ta-ta','https://www.tata.com.uy','mid',1),('UY','Disco','disco','https://www.disco.com.uy','mid',2),('UY','Devoto','devoto','https://www.devoto.com.uy','mid',3),('UY','Tienda Inglesa','tienda-inglesa','https://www.tiendainglesa.com.uy','premium',4),
('PY','Superseis','superseis','https://www.superseis.com.py','mid',1),('PY','Stock','stock','https://www.stock.com.py','mid',2),('PY','Salemma','salemma','https://www.salemma.com.py','mid',3),('PY','Areté','arete','https://www.arete.com.py','mid',4),('PY','Fortis','fortis','https://www.fortis.com.py','budget',5),
('EC','Supermaxi','supermaxi','https://www.supermaxi.com','mid',1),('EC','Megamaxi','megamaxi','https://www.megamaxi.com','mid',2),('EC','Mi Comisariato','mi-comisariato','https://www.micomisariato.com','mid',3),('EC','Tía','tia','https://www.tia.com.ec','budget',4),('EC','Coral','coral','https://www.coralhipermercados.com','mid',5),
('BO','Hipermaxi','hipermaxi','https://www.hipermaxi.com','mid',1),('BO','Fidalga','fidalga','https://www.fidalga.com','mid',2),('BO','IC Norte','ic-norte','https://www.icnorte.com','mid',3),('BO','Ketal','ketal','https://www.ketal.com.bo','mid',4),
('VE','Central Madeirense','central-madeirense','https://www.centralmadeirense.com','mid',1),('VE','Excelsior Gama','excelsior-gama','https://www.excelsiorgama.com','premium',2),('VE','Plaza''s','plazas','https://www.plazas.com','mid',3),('VE','Unicasa','unicasa','https://www.unicasa.com.ve','mid',4),('VE','Makro','makro','https://www.makro.com.ve','budget',5),
('GY','Massy Stores','massy-stores','https://massystores.gy','mid',1),('GY','DSL Cash & Carry','dsl-cash-carry','https://www.dslgy.com','budget',2),('GY','Survival Supermarket','survival','https://survivalgy.com','mid',3),
('SR','Choi''s Supermarket','chois','https://www.chois.sr','mid',1),('SR','Tulip','tulip','https://www.tulip.sr','mid',2),('SR','Fernandes','fernandes','https://www.fernandes.sr','mid',3),
-- United States
('US','Walmart','walmart','https://www.walmart.com','budget',1),('US','Kroger','kroger','https://www.kroger.com','mid',2),('US','Costco','costco','https://www.costco.com','budget',3),('US','Target','target','https://www.target.com','mid',4),('US','Albertsons','albertsons','https://www.albertsons.com','mid',5),('US','Publix','publix','https://www.publix.com','mid',6),('US','Aldi','aldi','https://www.aldi.us','budget',7),('US','Trader Joe''s','trader-joes','https://www.traderjoes.com','mid',8),('US','Whole Foods Market','whole-foods','https://www.wholefoodsmarket.com','premium',9),('US','H-E-B','heb','https://www.heb.com','mid',10),('US','Meijer','meijer','https://www.meijer.com','mid',11),('US','Sam''s Club','sams-club','https://www.samsclub.com','budget',12),('US','Wegmans','wegmans','https://www.wegmans.com','premium',13),
-- Canada
('CA','Loblaws','loblaws','https://www.loblaws.ca','mid',1),('CA','Real Canadian Superstore','real-canadian-superstore','https://www.realcanadiansuperstore.ca','mid',2),('CA','No Frills','no-frills','https://www.nofrills.ca','budget',3),('CA','Sobeys','sobeys','https://www.sobeys.com','mid',4),('CA','Safeway','safeway','https://www.safeway.ca','mid',5),('CA','Metro','metro','https://www.metro.ca','mid',6),('CA','Food Basics','food-basics','https://www.foodbasics.ca','budget',7),('CA','Walmart','walmart','https://www.walmart.ca','budget',8),('CA','Costco','costco','https://www.costco.ca','budget',9),('CA','FreshCo','freshco','https://www.freshco.com','budget',10),('CA','IGA','iga','https://www.iga.net','mid',11),('CA','Save-On-Foods','save-on-foods','https://www.saveonfoods.com','mid',12)
on conflict (country_code,slug) do update set
  name=excluded.name, website=excluded.website, price_position=excluded.price_position,
  display_order=excluded.display_order, enabled=true;
