type WarnaKomoditas = { variabel: string; latar: string };

const WARNA: Record<string, WarnaKomoditas> = {
	nickel: { variabel: '--color-tier-high', latar: 'bg-tier-high' },
	copper: { variabel: '--color-tier-high', latar: 'bg-tier-high' },
	bauxite: { variabel: '--color-tier-moderate', latar: 'bg-tier-moderate' },
	gold: { variabel: '--color-tier-low', latar: 'bg-tier-low' },
	silver: { variabel: '--color-secondary', latar: 'bg-secondary' },
	coal: { variabel: '--color-secondary', latar: 'bg-secondary' }
};

export function warnaKomoditas(nama: string): WarnaKomoditas {
	return WARNA[nama.toLowerCase()] ?? { variabel: '--color-diamond-300', latar: 'bg-diamond-300' };
}
