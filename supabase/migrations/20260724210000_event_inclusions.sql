-- What the entry fee includes (race kit, medal, aid stations, ...), shown on the pay screen
-- and event detail for pricing transparency. A simple ordered list of short phrases.
alter table events add column if not exists inclusions text[];
