-- Seed organizations
insert into organizations (id, name, website, description) values
  ('a0000000-0000-0000-0000-000000000001', 'Raleigh Parks & Recreation', 'https://raleighnc.gov/parks', 'City of Raleigh parks and recreation programs'),
  ('a0000000-0000-0000-0000-000000000002', 'YMCA of the Triangle', 'https://www.ymcatriangle.org', 'YMCA camps and programs across the Triangle'),
  ('a0000000-0000-0000-0000-000000000003', 'Marbles Kids Museum', 'https://www.marbleskidsmuseum.org', 'Interactive children''s museum and camp programs'),
  ('a0000000-0000-0000-0000-000000000004', 'Town of Cary Parks', 'https://www.townofcary.org/recreation-enjoyment', 'Town of Cary recreational programs'),
  ('a0000000-0000-0000-0000-000000000005', 'Triangle Aquatic Center', 'https://www.triangleaquatics.org', 'Competitive and recreational swimming programs');

-- Seed activities
insert into activities (id, organization_id, name, slug, description, categories, age_min, age_max, indoor_outdoor, registration_url, data_confidence, is_active) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Nature Explorers Camp', 'nature-explorers-camp', 'Kids explore Raleigh''s greenways, learn about local wildlife, and create nature art projects.', '{nature,arts}', 5, 9, 'outdoor', 'https://raleighnc.gov/parks/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'YMCA Soccer Stars', 'ymca-soccer-stars', 'Introduction to soccer fundamentals in a fun, non-competitive environment.', '{sports}', 4, 7, 'outdoor', 'https://www.ymcatriangle.org/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Marbles STEM Inventors', 'marbles-stem-inventors', 'Hands-on STEM projects: robotics, coding, and engineering challenges.', '{stem}', 6, 10, 'indoor', 'https://www.marbleskidsmuseum.org/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Little Artists Studio', 'little-artists-studio', 'Painting, sculpture, and mixed media for young artists.', '{arts}', 3, 6, 'indoor', 'https://raleighnc.gov/parks/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'Cary Tennis Academy', 'cary-tennis-academy', 'Learn tennis basics at Cary Tennis Park with certified instructors.', '{sports}', 6, 12, 'outdoor', 'https://www.townofcary.org/recreation-enjoyment', 'high', true),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000005', 'Swim Camp: Beginner', 'swim-camp-beginner', 'Learn-to-swim program for beginners. Small group instruction.', '{swimming}', 4, 8, 'indoor', 'https://www.triangleaquatics.org/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'YMCA Drama Workshop', 'ymca-drama-workshop', 'Kids write, rehearse, and perform a short play in one week.', '{theater}', 7, 12, 'indoor', 'https://www.ymcatriangle.org/camps', 'high', true),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'Marbles Cooking Adventures', 'marbles-cooking-adventures', 'Kid-friendly recipes, kitchen safety, and food science.', '{cooking}', 6, 10, 'indoor', 'https://www.marbleskidsmuseum.org/camps', 'high', true);

-- Seed activity locations (Raleigh area coordinates)
insert into activity_locations (id, activity_id, address, location, location_name) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2012 Lake Wheeler Rd, Raleigh, NC 27603', ST_SetSRID(ST_MakePoint(-78.6569, 35.7488), 4326), 'Walnut Creek Wetland Center'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '1601 Hillsborough St, Raleigh, NC 27605', ST_SetSRID(ST_MakePoint(-78.6614, 35.7872), 4326), 'A.E. Finley YMCA'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', '201 E Hargett St, Raleigh, NC 27601', ST_SetSRID(ST_MakePoint(-78.6362, 35.7796), 4326), 'Marbles Kids Museum'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', '820 Clay St, Raleigh, NC 27605', ST_SetSRID(ST_MakePoint(-78.6553, 35.7917), 4326), 'Sertoma Arts Center'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', '2727 Louis Stephens Dr, Cary, NC 27519', ST_SetSRID(ST_MakePoint(-78.7406, 35.7515), 4326), 'Cary Tennis Park'),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', '275 Convention Dr, Cary, NC 27511', ST_SetSRID(ST_MakePoint(-78.7811, 35.7849), 4326), 'Triangle Aquatic Center'),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', '1601 Hillsborough St, Raleigh, NC 27605', ST_SetSRID(ST_MakePoint(-78.6614, 35.7872), 4326), 'A.E. Finley YMCA'),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', '201 E Hargett St, Raleigh, NC 27601', ST_SetSRID(ST_MakePoint(-78.6362, 35.7796), 4326), 'Marbles Kids Museum');

-- Seed sessions (summer 2026 weeks)
insert into sessions (id, activity_id, activity_location_id, starts_at, ends_at, time_slot, hours_start, hours_end) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-06-15', '2026-06-19', 'full_day', '09:00', '15:00'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-06-22', '2026-06-26', 'full_day', '09:00', '15:00'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-07-06', '2026-07-10', 'full_day', '09:00', '15:00'),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '2026-06-15', '2026-06-19', 'am_half', '09:00', '12:00'),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '2026-07-13', '2026-07-17', 'am_half', '09:00', '12:00'),
  ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '2026-06-22', '2026-06-26', 'full_day', '09:00', '16:00'),
  ('d0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '2026-07-20', '2026-07-24', 'full_day', '09:00', '16:00'),
  ('d0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', '2026-06-15', '2026-06-19', 'am_half', '09:30', '12:00'),
  ('d0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', '2026-07-06', '2026-07-10', 'am_half', '09:30', '12:00'),
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', '2026-07-27', '2026-07-31', 'am_half', '09:30', '12:00'),
  ('d0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', '2026-06-29', '2026-07-03', 'am_half', '08:30', '11:30'),
  ('d0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', '2026-07-27', '2026-07-31', 'am_half', '08:30', '11:30'),
  ('d0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '2026-06-15', '2026-06-19', 'pm_half', '13:00', '15:30'),
  ('d0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '2026-06-22', '2026-06-26', 'pm_half', '13:00', '15:30'),
  ('d0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '2026-07-06', '2026-07-10', 'pm_half', '13:00', '15:30'),
  ('d0000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '2026-07-13', '2026-07-17', 'pm_half', '13:00', '15:30'),
  ('d0000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000007', '2026-07-13', '2026-07-17', 'full_day', '09:00', '15:00'),
  ('d0000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000008', '2026-06-29', '2026-07-03', 'am_half', '09:30', '12:30'),
  ('d0000000-0000-0000-0000-000000000019', 'b0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000008', '2026-07-20', '2026-07-24', 'am_half', '09:30', '12:30');

-- Seed price options
insert into price_options (activity_id, label, price_cents, price_unit, conditions, confidence) values
  ('b0000000-0000-0000-0000-000000000001', 'Standard', 28500, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000001', 'Early Bird', 24500, 'per_week', 'Register before May 1', 'verified'),
  ('b0000000-0000-0000-0000-000000000002', 'Standard', 16500, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000002', 'Sibling', 14500, 'per_week', '2nd child 10% off', 'verified'),
  ('b0000000-0000-0000-0000-000000000003', 'Standard', 35000, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000004', 'Standard', 12000, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000005', 'Standard', 22000, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000006', 'Standard', 18500, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000006', '4-Week Bundle', 64000, 'per_block', 'All 4 weeks', 'verified'),
  ('b0000000-0000-0000-0000-000000000007', 'Standard', 27500, 'per_week', null, 'verified'),
  ('b0000000-0000-0000-0000-000000000008', 'Standard', 25000, 'per_week', null, 'verified');
