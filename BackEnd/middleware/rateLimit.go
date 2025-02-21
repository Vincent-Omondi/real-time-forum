package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type Visitor struct {
	LastSeen time.Time
	Count    int
}

type RateLimiter struct {
	Visitors map[string]*Visitor
	Mu       sync.RWMutex
	Rate     int           // Maximum requests per interval
	Interval time.Duration // Time interval for rate limiting
	Ctx      context.Context
	Cancel   context.CancelFunc
}

func NewRateLimiter(rate int, interval time.Duration) *RateLimiter {
	ctx, cancel := context.WithCancel(context.Background())
	return &RateLimiter{
		Visitors: make(map[string]*Visitor),
		Rate:     rate,
		Interval: interval,
		Ctx:      ctx,
		Cancel:   cancel,
	}
}

func (rl *RateLimiter) CleanupVisitors(interval time.Duration) {
	for {
		select {
		case <-rl.Ctx.Done():
			return // Exit the goroutine when the context is canceled
		case <-time.After(interval):
			rl.Mu.Lock()
			for ip, v := range rl.Visitors {
				if time.Since(v.LastSeen) > rl.Interval {
					delete(rl.Visitors, ip)
				}
			}
			rl.Mu.Unlock()
		}
	}
}

func (rl *RateLimiter) RateLimit(next http.Handler) http.Handler {
	go rl.CleanupVisitors(time.Minute)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr

		rl.Mu.Lock()
		v, exists := rl.Visitors[ip]
		if !exists {
			rl.Visitors[ip] = &Visitor{
				LastSeen: time.Now(),
				Count:    1,
			}
			rl.Mu.Unlock()
			next.ServeHTTP(w, r)
			return
		}

		if time.Since(v.LastSeen) > rl.Interval {
			v.Count = 1
		} else {
			v.Count++
		}
		v.LastSeen = time.Now()

		if v.Count > rl.Rate {
			rl.Mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Rate limit exceeded",
				"status":  "error",
				"message": "Too many requests. Please try again later.",
			})
			return
		}
		rl.Mu.Unlock()

		next.ServeHTTP(w, r)
	})
}
