UPDATE gallery_credit_packages
SET name = 'Select 2k',
    credits = 2000,
    price_cents = 1990,
    description = 'Para quem está começando a organizar suas seleções de forma profissional.',
    updated_at = NOW()
WHERE sort_order = 1;

UPDATE gallery_credit_packages
SET name = 'Select 5k',
    credits = 5000,
    price_cents = 3990,
    description = 'Para fotógrafos em crescimento que já têm volume recorrente.',
    updated_at = NOW()
WHERE sort_order = 2;

UPDATE gallery_credit_packages
SET name = 'Select 10k',
    credits = 10000,
    price_cents = 6990,
    description = 'Pensado para quem já opera com constância.',
    updated_at = NOW()
WHERE sort_order = 3;

UPDATE gallery_credit_packages
SET name = 'Select 15k',
    credits = 15000,
    price_cents = 9490,
    description = 'Para fotógrafos que tratam seleção como parte estratégica da experiência do cliente.',
    updated_at = NOW()
WHERE sort_order = 4;