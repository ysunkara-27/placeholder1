with continents(slug, label) as (
  values
    ('north_america', 'North America'),
    ('south_america', 'South America'),
    ('europe', 'Europe'),
    ('asia', 'Asia'),
    ('africa', 'Africa'),
    ('australia', 'Australia')
)
insert into public.taxonomy_nodes (dimension, slug, label, parent_node_id, depth, is_leaf)
select 'geo', c.slug, c.label, root.id, 1, false
from continents c
join public.taxonomy_nodes root
  on root.dimension = 'geo'
 and root.slug = 'root'
on conflict (dimension, slug) do update
set label = excluded.label,
    parent_node_id = excluded.parent_node_id,
    depth = excluded.depth,
    is_leaf = excluded.is_leaf,
    status = 'active';

update public.taxonomy_nodes
set parent_node_id = north_america.id,
    depth = 2,
    is_leaf = false,
    status = 'active'
from public.taxonomy_nodes as north_america
where taxonomy_nodes.dimension = 'geo'
  and taxonomy_nodes.slug in ('usa', 'canada')
  and north_america.dimension = 'geo'
  and north_america.slug = 'north_america';

with recursive geo_tree as (
  select id, parent_node_id, 0 as depth
  from public.taxonomy_nodes
  where dimension = 'geo'
    and slug = 'root'

  union all

  select child.id, child.parent_node_id, geo_tree.depth + 1
  from public.taxonomy_nodes child
  join geo_tree on child.parent_node_id = geo_tree.id
  where child.dimension = 'geo'
)
update public.taxonomy_nodes as node
set depth = geo_tree.depth,
    is_leaf = not exists (
      select 1
      from public.taxonomy_nodes child
      where child.dimension = 'geo'
        and child.parent_node_id = node.id
    )
from geo_tree
where node.id = geo_tree.id
  and node.dimension = 'geo';

select public.rebuild_taxonomy_paths();
