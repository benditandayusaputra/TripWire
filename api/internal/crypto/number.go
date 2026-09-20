package crypto

import (
	"strconv"
	"strings"
)

func normalkanAngka(literal string) string {
	teks := strings.TrimSpace(literal)
	if teks == "" {
		return "0"
	}

	negatif := false
	switch teks[0] {
	case '-':
		negatif = true
		teks = teks[1:]
	case '+':
		teks = teks[1:]
	}

	eksponen := 0
	if pos := strings.IndexAny(teks, "eE"); pos >= 0 {
		nilai, err := strconv.Atoi(teks[pos+1:])
		if err != nil {
			return literal
		}
		eksponen = nilai
		teks = teks[:pos]
	}

	bagianBulat, bagianPecahan, _ := strings.Cut(teks, ".")
	digit := bagianBulat + bagianPecahan
	titik := len(bagianBulat) + eksponen

	for titik <= 0 {
		digit = "0" + digit
		titik++
	}
	for titik > len(digit) {
		digit += "0"
	}

	bulat := strings.TrimLeft(digit[:titik], "0")
	if bulat == "" {
		bulat = "0"
	}

	pecahan := strings.TrimRight(digit[titik:], "0")

	hasil := bulat
	if pecahan != "" {
		hasil += "." + pecahan
	}

	if negatif && hasil != "0" {
		hasil = "-" + hasil
	}

	return hasil
}
