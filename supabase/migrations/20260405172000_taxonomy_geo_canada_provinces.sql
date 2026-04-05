with provinces(slug, label) as (
  values
    ('alberta', 'Alberta'),
    ('british_columbia', 'British Columbia'),
    ('manitoba', 'Manitoba'),
    ('new_brunswick', 'New Brunswick'),
    ('newfoundland_and_labrador', 'Newfoundland and Labrador'),
    ('northwest_territories', 'Northwest Territories'),
    ('nova_scotia', 'Nova Scotia'),
    ('nunavut', 'Nunavut'),
    ('ontario', 'Ontario'),
    ('prince_edward_island', 'Prince Edward Island'),
    ('quebec', 'Quebec'),
    ('saskatchewan', 'Saskatchewan'),
    ('yukon', 'Yukon')
)
insert into public.taxonomy_nodes (dimension, slug, label, parent_node_id, depth, is_leaf)
select 'geo', p.slug, p.label, canada.id, 2, false
from provinces p
join public.taxonomy_nodes canada
  on canada.dimension = 'geo'
 and canada.slug = 'canada'
on conflict (dimension, slug) do update
set label = excluded.label,
    parent_node_id = excluded.parent_node_id,
    depth = excluded.depth,
    is_leaf = excluded.is_leaf,
    status = 'active';

select public.rebuild_taxonomy_paths();
