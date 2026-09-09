package crypto

import "testing"

func TestNormalkanAngka(t *testing.T) {
	kasus := map[string]string{
		"1e-07": "0.0000001", "1.50": "1.5", "1e3": "1000", "44000000000000": "44000000000000",
		"-0": "0", "0.0": "0", "62.5": "62.5", "1.23e2": "123", "-1.500": "-1.5",
		"0.000000000000000001": "0.000000000000000001", "1e21": "1000000000000000000000",
	}
	for masukan, harapan := range kasus {
		if hasil := normalkanAngka(masukan); hasil != harapan {
			t.Errorf("normalkanAngka(%q) = %q, harusnya %q", masukan, hasil, harapan)
		}
	}
}
