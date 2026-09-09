package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/pquerna/otp/totp"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

const (
	domainDemo    = "@tripwire.demo"
	domainTest    = "@tripwire.test"
	passwordDemo  = "TripWireDemo123"
	pemantauLabel = "Seeder akun demo"
)

type kondisiDemo struct {
	jenis  string
	config map[string]any
}

type akunDemo struct {
	email         string
	nama          string
	peran         string
	terverifikasi bool
	terkunci      bool
	duaFaktor     bool
	watchlist     map[string][]kondisiDemo
	catatan       string
}

var daftarAkun = []akunDemo{
	{
		email:         "admin" + domainDemo,
		nama:          "Bendi Admin",
		peran:         "admin",
		terverifikasi: true,
		watchlist: map[string][]kondisiDemo{
			"ANTM": {{jenis: model.ConditionDaily}},
			"PTBA": {{jenis: model.ConditionWeekly, config: map[string]any{"weekday": 1}}},
		},
		catatan: "Bisa membuka panel admin, memicu scan manual, dan melihat kuota Sectors",
	},
	{
		email:         "investor" + domainDemo,
		nama:          "Rani Investor",
		peran:         "user",
		terverifikasi: true,
		watchlist: map[string][]kondisiDemo{
			"ANTM": {
				{jenis: model.ConditionDaily},
				{jenis: model.ConditionRecentEvent, config: map[string]any{"min_score": 60}},
			},
			"MDKA": {{jenis: model.ConditionPeriodicCustom, config: map[string]any{"interval_hours": 6}}},
			"BBCA": {{jenis: model.ConditionWeekly, config: map[string]any{"weekday": 3}}},
			"INCO": {{jenis: model.ConditionGeopolitical, config: map[string]any{"min_score": 45}}},
		},
		catatan: "Watchlist terisi empat emiten dengan semua jenis kondisi pemicu",
	},
	{
		email:         "duafaktor" + domainDemo,
		nama:          "Sita Dua Faktor",
		peran:         "user",
		terverifikasi: true,
		duaFaktor:     true,
		watchlist: map[string][]kondisiDemo{
			"PTBA": {{jenis: model.ConditionDaily}},
		},
		catatan: "TOTP sudah aktif, secret dan kode cadangan dicetak di bawah",
	},
	{
		email:   "baru" + domainDemo,
		nama:    "Andi Pengguna Baru",
		peran:   "user",
		catatan: "Email belum diverifikasi dan watchlist masih kosong, untuk menguji alur onboarding",
	},
	{
		email:         "terkunci" + domainDemo,
		nama:          "Doni Terkunci",
		peran:         "user",
		terverifikasi: true,
		terkunci:      true,
		catatan:       "Sengaja dikunci sampai satu jam ke depan, untuk menguji tampilan lockout",
	},
}

type hasilSeed struct {
	akun       akunDemo
	totpSecret string
	backup     []string
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	store, err := repository.NewStore(ctx, cfg.PostgresDSN, cfg.RedisURL)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer store.Close()

	users := repository.NewUserRepository(store)
	audit := repository.NewAuditRepository(store)
	twoFactorRepo := repository.NewTwoFactorRepository(store)

	tickers, err := service.NewTickerService(store.Redis)
	if err != nil {
		log.Fatalf("ticker: %v", err)
	}
	_ = tickers.LoadFromCache(ctx)

	cipher, err := crypto.NewCipher(cfg.TOTPEncryptionKey)
	if err != nil {
		log.Fatalf("cipher: %v", err)
	}

	watchlist := service.NewWatchlistService(repository.NewWatchlistRepository(store), tickers)
	twoFactor := service.NewTwoFactorService(cfg, twoFactorRepo, users, audit, cipher)

	if bersihkanTest() {
		jumlah, err := hapusAkunTest(ctx, store)
		if err != nil {
			log.Fatalf("bersihkan akun test: %v", err)
		}
		fmt.Printf("Menghapus %d akun sisa test berdomain %s\n", jumlah, domainTest)

		insight, err := hapusInsight(ctx, store)
		if err != nil {
			log.Fatalf("bersihkan insight: %v", err)
		}
		fmt.Printf("Menghapus %d insight lama, rantai hash dimulai ulang dari nol\n", insight)
	}

	if err := hapusAkunDemo(ctx, store); err != nil {
		log.Fatalf("bersihkan akun demo: %v", err)
	}

	hasil := make([]hasilSeed, 0, len(daftarAkun))

	for _, akun := range daftarAkun {
		satu, err := buatAkun(ctx, store, users, watchlist, twoFactor, akun)
		if err != nil {
			log.Fatalf("%s: %v", akun.email, err)
		}
		hasil = append(hasil, *satu)
	}

	cetakRingkasan(hasil)
}

func bersihkanTest() bool {
	for _, argumen := range os.Args[1:] {
		if argumen == "--bersihkan-test" {
			return true
		}
	}
	return false
}

func hapusAkunTest(ctx context.Context, store *repository.Store) (int64, error) {
	hasil, err := store.DB.ExecContext(ctx, `DELETE FROM users WHERE email LIKE '%' || $1`, domainTest)
	if err != nil {
		return 0, err
	}
	return hasil.RowsAffected()
}

func hapusInsight(ctx context.Context, store *repository.Store) (int64, error) {
	hasil, err := store.DB.ExecContext(ctx, `DELETE FROM insight_events`)
	if err != nil {
		return 0, err
	}
	return hasil.RowsAffected()
}

func hapusAkunDemo(ctx context.Context, store *repository.Store) error {
	_, err := store.DB.ExecContext(ctx, `DELETE FROM users WHERE email LIKE '%' || $1`, domainDemo)
	return err
}

func buatAkun(
	ctx context.Context,
	store *repository.Store,
	users *repository.UserRepository,
	watchlist *service.WatchlistService,
	twoFactor *service.TwoFactorService,
	akun akunDemo,
) (*hasilSeed, error) {
	salt, err := crypto.NewPasswordSalt()
	if err != nil {
		return nil, err
	}

	hash, err := crypto.HashPassword(salt, passwordDemo, 10)
	if err != nil {
		return nil, err
	}

	pengguna, err := users.Create(ctx, akun.email, akun.nama, hash, salt)
	if err != nil {
		return nil, err
	}

	if akun.terverifikasi {
		if err := users.MarkEmailVerified(ctx, pengguna.ID); err != nil {
			return nil, err
		}
	}

	if akun.peran == "admin" {
		if _, err := store.DB.ExecContext(ctx,
			`UPDATE users SET role_id = 2 WHERE id = $1`, pengguna.ID); err != nil {
			return nil, err
		}
	}

	if akun.terkunci {
		if _, err := store.DB.ExecContext(ctx,
			`UPDATE users SET failed_login_attempts = 5, locked_until = now() + interval '1 hour'
			 WHERE id = $1`, pengguna.ID); err != nil {
			return nil, err
		}
	}

	for ticker, kondisi := range akun.watchlist {
		item, err := watchlist.Add(ctx, pengguna.ID, ticker, model.DisplayInsightPlus)
		if err != nil {
			return nil, fmt.Errorf("tambah %s: %w", ticker, err)
		}

		for _, satu := range kondisi {
			isi, err := json.Marshal(satu.config)
			if err != nil {
				return nil, err
			}
			if _, err := watchlist.AddCondition(ctx, pengguna.ID, item.ID, satu.jenis, isi, true); err != nil {
				return nil, fmt.Errorf("kondisi %s pada %s: %w", satu.jenis, ticker, err)
			}
		}
	}

	hasil := &hasilSeed{akun: akun}

	if akun.duaFaktor {
		rc := service.RequestContext{IPAddress: "127.0.0.1", UserAgent: pemantauLabel}

		setup, err := twoFactor.Setup(ctx, pengguna.ID, rc)
		if err != nil {
			return nil, err
		}

		kode, err := totp.GenerateCode(setup.Secret, time.Now())
		if err != nil {
			return nil, err
		}

		backup, err := twoFactor.Verify(ctx, pengguna.ID, kode, rc)
		if err != nil {
			return nil, err
		}

		hasil.totpSecret = setup.Secret
		hasil.backup = backup
	}

	return hasil, nil
}

func cetakRingkasan(hasil []hasilSeed) {
	keluar := os.Stdout

	fmt.Fprintf(keluar, "\nAkun demo TripWire siap. Password sama untuk semuanya: %s\n\n", passwordDemo)
	fmt.Fprintf(keluar, "%-26s %-22s %-8s %-11s %s\n", "EMAIL", "NAMA", "PERAN", "STATUS", "CATATAN")
	fmt.Fprintln(keluar, strings.Repeat("-", 118))

	for _, satu := range hasil {
		status := "aktif"
		switch {
		case satu.akun.terkunci:
			status = "terkunci"
		case !satu.akun.terverifikasi:
			status = "belum verif"
		case satu.akun.duaFaktor:
			status = "2FA aktif"
		}

		fmt.Fprintf(keluar, "%-26s %-22s %-8s %-11s %s\n",
			satu.akun.email, satu.akun.nama, satu.akun.peran, status, satu.akun.catatan)
	}

	for _, satu := range hasil {
		if satu.totpSecret == "" {
			continue
		}

		fmt.Fprintf(keluar, "\nTOTP untuk %s\n", satu.akun.email)
		fmt.Fprintf(keluar, "  secret authenticator : %s\n", satu.totpSecret)
		fmt.Fprintf(keluar, "  kode cadangan        : %s\n", strings.Join(satu.backup, "  "))
	}

	fmt.Fprintln(keluar, "\nAkun demo dikenali dari domain "+domainDemo+
		" dan seluruhnya dibuat ulang tiap seeder dijalankan.")
	fmt.Fprintln(keluar, "Feed insight masih kosong sampai scan dijalankan, pakai tombol scan manual di"+
		" panel admin atau jalankan cmd/scheduler dengan SCHEDULER_RUN_ON_START=true.")
}
