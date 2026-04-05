update public.taxonomy_nodes
set label = case slug
  when 'toronto' then 'Toronto, ON'
  when 'san_francisco_bay_area' then 'San Francisco, CA'
  when 'los_angeles' then 'Los Angeles, CA'
  when 'san_diego' then 'San Diego, CA'
  when 'seattle' then 'Seattle, WA'
  when 'denver' then 'Denver, CO'
  when 'new_york_city' then 'New York, NY'
  when 'boston' then 'Boston, MA'
  when 'pittsburgh' then 'Pittsburgh, PA'
  when 'austin' then 'Austin, TX'
  when 'dallas' then 'Dallas, TX'
  when 'houston' then 'Houston, TX'
  when 'atlanta' then 'Atlanta, GA'
  when 'miami' then 'Miami, FL'
  when 'raleigh' then 'Raleigh, NC'
  when 'chicago' then 'Chicago, IL'
  when 'detroit' then 'Detroit, MI'
  when 'columbus' then 'Columbus, OH'
  else label
end
where dimension = 'geo'
  and slug in (
    'toronto',
    'san_francisco_bay_area',
    'los_angeles',
    'san_diego',
    'seattle',
    'denver',
    'new_york_city',
    'boston',
    'pittsburgh',
    'austin',
    'dallas',
    'houston',
    'atlanta',
    'miami',
    'raleigh',
    'chicago',
    'detroit',
    'columbus'
  );
