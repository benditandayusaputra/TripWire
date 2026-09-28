import type { Attachment } from 'svelte/attachments';

export function saatTerlihat(aksi: () => void, batasBawah = '-15%'): Attachment<HTMLElement> {
	return (node) => {
		const pengamat = new IntersectionObserver(
			(entri) => {
				if (!entri.some((item) => item.isIntersecting)) return;
				pengamat.disconnect();
				aksi();
			},
			{ rootMargin: `0px 0px ${batasBawah} 0px` }
		);
		pengamat.observe(node);
		return () => pengamat.disconnect();
	};
}

export const gerakDikurangi = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const terlihat: Attachment<HTMLElement> = (node) => {
	if (gerakDikurangi() || node.getBoundingClientRect().top < innerHeight * 0.85) return;
	node.classList.add('siap');
	return saatTerlihat(() => node.classList.add('terlihat'))(node);
};
