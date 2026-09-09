package main

import (
	"fmt"
	"log"

	"github.com/benditandayusaputra/tripwire/api/pkg/webpush"
)

func main() {
	privat, publik, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		log.Fatalf("vapid: %v", err)
	}
	fmt.Printf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", publik, privat)
}
