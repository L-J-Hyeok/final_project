-- 008: Allow smartwatch, earbuds, speaker directly in owned_devices.category
-- while retaining watch and other for full backward compatibility.
ALTER TABLE owned_devices
  DROP CHECK ck_owned_category,
  ADD CONSTRAINT ck_owned_category CHECK (
    category IN (
      'smartphone', 'laptop', 'tablet', 'watch', 'smartwatch', 'earbuds', 'speaker',
      'monitor', 'pc', 'cpu', 'gpu', 'ram', 'ssd', 'motherboard', 'psu', 'case', 'cooler', 'other'
    )
  );
