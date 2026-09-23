package store

import (
	"errors"
	"strings"
	"syscall"
	"testing"
)

func TestExplainConnectFailureIPv6OnlyHost(t *testing.T) {
	original := lookupHost
	lookupHost = func(host string) ([]string, error) {
		return []string{"2406:da18:1691:a202::95b"}, nil
	}
	t.Cleanup(func() { lookupHost = original })

	dsn := "postgresql://postgres:sekrit@db.example.supabase.co:5432/postgres?sslmode=require"
	msg := explainConnectFailure(dsn, syscall.ENETUNREACH)

	for _, want := range []string{
		"IPv6-only",
		"db.example.supabase.co",
		"Session pooler",
		"postgres.<project-ref>",
		"6543",
	} {
		if !strings.Contains(msg, want) {
			t.Errorf("message missing %q:\n%s", want, msg)
		}
	}
	if strings.Contains(msg, "sekrit") {
		t.Errorf("password leaked into diagnostic message:\n%s", msg)
	}
}

func TestExplainConnectFailurePassesThroughOtherErrors(t *testing.T) {
	msg := explainConnectFailure(
		"postgresql://postgres@db.example.supabase.co:5432/postgres",
		errors.New(`password authentication failed for user "postgres"`),
	)
	if !strings.Contains(msg, "password authentication failed") {
		t.Errorf("unexpected message: %s", msg)
	}
	if strings.Contains(msg, "Session pooler") {
		t.Errorf("IPv6 hint should not attach to auth errors: %s", msg)
	}
}

func TestExplainConnectFailureUnreachableMessageWithoutErrno(t *testing.T) {
	original := lookupHost
	lookupHost = func(host string) ([]string, error) {
		return []string{"2001:db8::1"}, nil
	}
	t.Cleanup(func() { lookupHost = original })

	msg := explainConnectFailure(
		"postgresql://postgres@db.example.supabase.co:5432/postgres",
		errors.New("dial tcp: lookup db.example.supabase.co: network is unreachable"),
	)
	if !strings.Contains(msg, "Session pooler") {
		t.Errorf("expected pooler guidance, got: %s", msg)
	}
}

func TestDsnParts(t *testing.T) {
	host, user := dsnParts("postgresql://postgres.enjyf:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require")
	if host != "aws-0-ap-southeast-1.pooler.supabase.com" {
		t.Errorf("host = %q", host)
	}
	if user != "postgres.enjyf" {
		t.Errorf("user = %q", user)
	}
}
