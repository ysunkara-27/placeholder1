with states(slug, label, parent_slug) as (
  values
    ('connecticut', 'Connecticut', 'northeast'),
    ('maine', 'Maine', 'northeast'),
    ('massachusetts', 'Massachusetts', 'northeast'),
    ('new_hampshire', 'New Hampshire', 'northeast'),
    ('new_jersey', 'New Jersey', 'northeast'),
    ('new_york', 'New York', 'northeast'),
    ('pennsylvania', 'Pennsylvania', 'northeast'),
    ('rhode_island', 'Rhode Island', 'northeast'),
    ('vermont', 'Vermont', 'northeast'),
    ('alabama', 'Alabama', 'south'),
    ('arkansas', 'Arkansas', 'south'),
    ('delaware', 'Delaware', 'south'),
    ('florida', 'Florida', 'south'),
    ('georgia', 'Georgia', 'south'),
    ('kentucky', 'Kentucky', 'south'),
    ('louisiana', 'Louisiana', 'south'),
    ('maryland', 'Maryland', 'south'),
    ('mississippi', 'Mississippi', 'south'),
    ('north_carolina', 'North Carolina', 'south'),
    ('oklahoma', 'Oklahoma', 'south'),
    ('south_carolina', 'South Carolina', 'south'),
    ('tennessee', 'Tennessee', 'south'),
    ('texas', 'Texas', 'south'),
    ('virginia', 'Virginia', 'south'),
    ('west_virginia', 'West Virginia', 'south'),
    ('illinois', 'Illinois', 'midwest'),
    ('indiana', 'Indiana', 'midwest'),
    ('iowa', 'Iowa', 'midwest'),
    ('kansas', 'Kansas', 'midwest'),
    ('michigan', 'Michigan', 'midwest'),
    ('minnesota', 'Minnesota', 'midwest'),
    ('missouri', 'Missouri', 'midwest'),
    ('nebraska', 'Nebraska', 'midwest'),
    ('north_dakota', 'North Dakota', 'midwest'),
    ('ohio', 'Ohio', 'midwest'),
    ('south_dakota', 'South Dakota', 'midwest'),
    ('wisconsin', 'Wisconsin', 'midwest'),
    ('alaska', 'Alaska', 'west'),
    ('arizona', 'Arizona', 'west'),
    ('california', 'California', 'west'),
    ('colorado', 'Colorado', 'west'),
    ('hawaii', 'Hawaii', 'west'),
    ('idaho', 'Idaho', 'west'),
    ('montana', 'Montana', 'west'),
    ('nevada', 'Nevada', 'west'),
    ('new_mexico', 'New Mexico', 'west'),
    ('oregon', 'Oregon', 'west'),
    ('utah', 'Utah', 'west'),
    ('washington', 'Washington', 'west'),
    ('wyoming', 'Wyoming', 'west')
)
insert into public.taxonomy_nodes (dimension, slug, label, parent_node_id, depth, is_leaf)
select 'geo', s.slug, s.label, p.id, 3, false
from states s
join public.taxonomy_nodes p
  on p.dimension = 'geo'
 and p.slug = s.parent_slug
on conflict (dimension, slug) do update
set label = excluded.label,
    parent_node_id = excluded.parent_node_id,
    depth = excluded.depth,
    is_leaf = excluded.is_leaf,
    status = 'active';

select public.rebuild_taxonomy_paths();
