package model

type DependencyStatus struct {
	Connected bool   `json:"connected"`
	LatencyMS int64  `json:"latency_ms"`
	Error     string `json:"error,omitempty"`
}

type HealthStatus struct {
	Status   string           `json:"status"`
	Version  string           `json:"version"`
	Postgres DependencyStatus `json:"postgres"`
	Redis    DependencyStatus `json:"redis"`
}
