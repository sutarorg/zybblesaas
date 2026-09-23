package store

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
	"syscall"
)

// explainConnectFailure turns a low-level dial/ping error into an actionable
// message. Passwords never appear in the output — only host and username.
//
// The common Railway case: Supabase's direct host (db.<ref>.supabase.co) is
// AAAA-only, Railway has no outbound IPv6, and pgx fails with
// "network is unreachable" long before TLS or auth. The fix is the Session
// pooler connection string from the Supabase Connect dialog.
func explainConnectFailure(dsn string, cause error) string {
	host, _ := dsnParts(dsn)
	base := cause.Error()
	if !isUnreachable(cause) {
		return base
	}

	v4, v6, lookupErr := splitAddresses(host)
	if lookupErr != nil {
		return fmt.Sprintf("%s (host %q: %v)", base, host, lookupErr)
	}
	if len(v4) == 0 && len(v6) > 0 {
		return fmt.Sprintf(
			"%s — host %q is IPv6-only (%s) and this platform has no outbound IPv6 route. "+
				"Supabase direct hosts (db.<ref>.supabase.co) are AAAA-only unless the IPv4 add-on is enabled. "+
				"In the Supabase dashboard open Connect → Session pooler and set DATABASE_URL to that string "+
				"(host aws-<index>-<region>.pooler.supabase.com, port 5432, user postgres.<project-ref>, sslmode=require). "+
				"Do not use the transaction pooler on port 6543 — this worker holds long-lived connections.",
			base, host, strings.Join(v6, ","))
	}
	if len(v4) == 0 && len(v6) == 0 {
		return fmt.Sprintf("%s — host %q did not resolve to any address", base, host)
	}
	return base
}

func dsnParts(dsn string) (host, user string) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return "", ""
	}
	host = parsed.Hostname()
	if parsed.User != nil {
		user = parsed.User.Username()
	}
	return host, user
}

// lookupHost is net.LookupHost, indirection for tests.
var lookupHost = net.LookupHost

func splitAddresses(host string) (v4, v6 []string, err error) {
	if host == "" {
		return nil, nil, errors.New("empty host")
	}
	addrs, err := lookupHost(host)
	if err != nil {
		return nil, nil, err
	}
	for _, addr := range addrs {
		if strings.Contains(addr, ":") {
			v6 = append(v6, addr)
		} else {
			v4 = append(v4, addr)
		}
	}
	return v4, v6, nil
}

func isUnreachable(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, syscall.ENETUNREACH) || errors.Is(err, syscall.EHOSTUNREACH) {
		return true
	}
	var errno syscall.Errno
	if errors.As(err, &errno) {
		return errno == syscall.ENETUNREACH || errno == syscall.EHOSTUNREACH
	}
	return isUnreachableMessage(err.Error())
}

func isUnreachableMessage(msg string) bool {
	lower := strings.ToLower(msg)
	for _, needle := range []string{
		"network is unreachable",
		"host is unreachable",
		"no route to host",
		"enetunreach",
		"ehostunreach",
	} {
		if strings.Contains(lower, needle) {
			return true
		}
	}
	return false
}
