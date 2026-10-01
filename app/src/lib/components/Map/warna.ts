type WarnaKomoditas = { penanda: string; latar: string };

const WARNA: Record<string, WarnaKomoditas> = {
	nickel: { penanda: 'fill-tier-high stroke-tier-high', latar: 'bg-tier-high' },
	copper: { penanda: 'fill-tier-high stroke-tier-high', latar: 'bg-tier-high' },
	bauxite: { penanda: 'fill-tier-moderate stroke-tier-moderate', latar: 'bg-tier-moderate' },
	gold: { penanda: 'fill-tier-low stroke-tier-low', latar: 'bg-tier-low' },
	silver: { penanda: 'fill-secondary stroke-secondary', latar: 'bg-secondary' },
	coal: { penanda: 'fill-secondary stroke-secondary', latar: 'bg-secondary' }
};

export function warnaKomoditas(nama: string): WarnaKomoditas {
	return (
		WARNA[nama.toLowerCase()] ?? {
			penanda: 'fill-diamond-300 stroke-diamond-300',
			latar: 'bg-diamond-300'
		}
	);
}
