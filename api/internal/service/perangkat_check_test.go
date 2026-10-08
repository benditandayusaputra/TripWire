package service

import "testing"

func TestDeviceLabel(t *testing.T) {
	kasus := map[string]string{
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36":                   "Chrome di macOS",
		"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1": "Safari di iPhone",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0":           "Edge di Windows",
		"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36":                            "Chrome di Android",
		"node": "Perangkat tidak dikenal",
		"":     "Perangkat tidak dikenal",
	}
	for agen, harapan := range kasus {
		if hasil := deviceLabel(agen); hasil != harapan {
			t.Errorf("deviceLabel(%q) = %q, harapan %q", agen, hasil, harapan)
		}
	}
}
