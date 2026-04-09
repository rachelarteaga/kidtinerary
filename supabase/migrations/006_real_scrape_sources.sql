-- Real Raleigh/Triangle area camp and activity sources
INSERT INTO scrape_sources (url, adapter_type, scrape_frequency) VALUES
  -- Aggregator sites (richest data, use LLM extraction)
  ('https://rt.kidsoutandabout.com/content/guide-summer-camps-research-triangle-area', 'generic_llm', 'weekly'),
  ('https://rt.kidsoutandabout.com/content/day-camps-and-around-research-triangle-raleigh-durham-chapel-hill-area', 'generic_llm', 'weekly'),
  ('https://fun4raleighkids.com/Camps/Variety-Camps/', 'generic_llm', 'weekly'),
  ('https://fun4raleighkids.com/Camps/PAY-by-the-DAY-Camps/', 'generic_llm', 'weekly'),
  ('https://fun4raleighkids.com/Camps/Sports-Camps/', 'generic_llm', 'weekly'),
  ('https://fun4raleighkids.com/Camps/Art-Camps/', 'generic_llm', 'weekly'),
  ('https://fun4raleighkids.com/Camps/Academic-Camps/', 'generic_llm', 'weekly'),
  ('https://raleighsummercamps.com/', 'generic_llm', 'weekly'),
  ('https://triangleonthecheap.com/summer-camps/', 'generic_llm', 'weekly'),
  ('https://www.campsearch.com/best-raleigh-summer-camps', 'generic_llm', 'weekly'),
  ('https://www.raleighkidsguide.com/Summer_Camps.php', 'generic_llm', 'weekly'),
  -- Primary sources (individual organizations)
  ('https://raleighnc.gov/summer-camps', 'generic_llm', 'daily'),
  ('https://www.ymcatriangle.org/programs/camps/traditional-day-camps', 'generic_llm', 'daily'),
  ('https://www.ymcatriangle.org/programs/sports', 'generic_llm', 'weekly'),
  ('https://www.ymcatriangle.org/programs/swim', 'generic_llm', 'weekly'),
  ('https://www.marbleskidsmuseum.org/summer-camp', 'generic_llm', 'weekly'),
  ('https://durhamarts.org/dac-art-camps/', 'generic_llm', 'weekly')
ON CONFLICT (url) DO NOTHING;
