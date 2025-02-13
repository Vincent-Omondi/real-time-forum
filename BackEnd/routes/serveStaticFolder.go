package routes

import (
	"mime"
	"net/http"
	"path/filepath"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/middleware"
)

func init() {
	// Register additional MIME types
	mime.AddExtensionType(".js", "application/javascript")
	mime.AddExtensionType(".mjs", "application/javascript")
	mime.AddExtensionType(".css", "text/css")
}

func ServeStaticFolder() {
	// FileServer wrapper to set correct content types
	fileServer := func(root http.FileSystem) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Set correct content type based on file extension
			ext := filepath.Ext(r.URL.Path)
			switch ext {
			case ".js":
				w.Header().Set("Content-Type", "application/javascript")
			case ".css":
				w.Header().Set("Content-Type", "text/css")
			}
			http.FileServer(root).ServeHTTP(w, r)
		})
	}

	// Serve static assets (CSS, JS, Images)
	http.Handle("/assets/", middleware.ApplyMiddleware(
		http.StripPrefix("/assets/", fileServer(http.Dir("./FrontEnd/assets"))),
		middleware.SetCSPHeaders,
	))

	http.Handle("/styles/", middleware.ApplyMiddleware(
		http.StripPrefix("/styles/", fileServer(http.Dir("./FrontEnd/styles"))),
		middleware.SetCSPHeaders,
	))

	http.Handle("/js/", middleware.ApplyMiddleware(
		http.StripPrefix("/js/", fileServer(http.Dir("./FrontEnd/js"))),
		middleware.SetCSPHeaders,
	))

	// Serve user uploads
	http.Handle("/uploads/", middleware.ApplyMiddleware(
		http.StripPrefix("/uploads/", fileServer(http.Dir("./uploads"))),
		middleware.SetCSPHeaders,
	))

	// SPA handler - serve index.html for all non-file routes
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If the request is for a file that exists, serve it
		if filepath.Ext(r.URL.Path) != "" {
			http.ServeFile(w, r, filepath.Join("FrontEnd", r.URL.Path))
			return
		}

		// For all other routes, serve the SPA's index.html
		w.Header().Set("Content-Type", "text/html")
		http.ServeFile(w, r, "./FrontEnd/index.html")
	})
}
