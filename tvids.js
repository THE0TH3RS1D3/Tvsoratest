const BASE_URL = "https://www.tvids.to";

async function searchResults(keyword) {
    try {
        const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(keyword)}`;
        
        // fetchv2 mit Fallback auf normales fetch
        let response;
        try {
            response = await fetchv2(searchUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5"
                }
            });
        } catch (e) {
            // Fallback: normales fetch (falls fetchv2 Probleme macht)
            response = await fetch(searchUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
        }

        const html = await response.text();
        
        // Prüfen, ob überhaupt HTML zurückkommt
        if (!html || html.length < 100) {
            return JSON.stringify([{ 
                title: "DEBUG: Leere Antwort von tvids.to (Status: " + response.status + ")", 
                image: "", href: "" 
            }]);
        }

        // DOMParser mit Fallback
        let doc;
        if (typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            doc = parser.parseFromString(html, "text/html");
        } else {
            // Fallback: Regex-basierte Extraktion (weniger zuverlässig, aber besser als nichts)
            return searchResultsRegexFallback(html, keyword);
        }

        // --- FLEXIBLERE SELEKTOREN ---
        const results = [];
        
        // Verschiedene mögliche Container ausprobieren
        const possibleItems = [
            ...doc.querySelectorAll("div.relative.text-gray-300"),
            ...doc.querySelectorAll(".movie-item, .film-item, .result-item"),
            ...doc.querySelectorAll("div[class*='relative'][class*='text-gray']"),
            ...doc.querySelectorAll("a[href*='/movies/'], a[href*='/watch']")
        ];

        // Duplikate entfernen
        const seen = new Set();
        const uniqueItems = possibleItems.filter(el => {
            const key = el.href || el.outerHTML?.substring(0, 100);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        uniqueItems.forEach((item) => {
            // Link extrahieren
            const linkEl = item.href ? item : item.querySelector("a[href*='/movies/'], a[href*='/watch']");
            if (!linkEl) return;

            const href = linkEl.getAttribute("href") || linkEl.href;
            if (!href) return;

            // Titel extrahieren
            let title = "";
            const titleEl = item.querySelector("div.text-center a, .title, h2, h3, h4");
            if (titleEl) title = titleEl.textContent.trim();
            if (!title && linkEl.title) title = linkEl.title;
            if (!title) title = linkEl.textContent.trim();
            if (!title) return;

            // Bild extrahieren
            let image = "";
            const imgEl = item.querySelector("img");
            if (imgEl) {
                image = imgEl.getAttribute("data-src") 
                     || imgEl.getAttribute("data-original")
                     || imgEl.getAttribute("src") 
                     || "";
            }

            results.push({ title, image, href });
        });

        if (results.length === 0) {
            return JSON.stringify([{ 
                title: "DEBUG: Keine Ergebnisse gefunden. HTML-Länge: " + html.length + " | Erste 200 Zeichen: " + html.substring(0, 200).replace(/\n/g, ' '), 
                image: "", href: "" 
            }]);
        }

        return JSON.stringify(results);

    } catch (error) {
        console.error("TVids searchResults Fehler:", error);
        return JSON.stringify([{ 
            title: "DEBUG: " + (error.message || error.toString()), 
            image: "", href: "" 
        }]);
    }
}

// Regex-Fallback, falls DOMParser nicht verfügbar ist
function searchResultsRegexFallback(html, keyword) {
    const results = [];
    // Einfache Regex, um Links und Titel zu extrahieren
    const linkRegex = /<a[^>]+href="([^"]*(?:movies|watch)[^"]*)"[^>]*>(.*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const title = match[2].replace(/<[^>]+>/g, '').trim();
        if (title && href) {
            results.push({ title, image: "", href });
        }
    }
    return JSON.stringify(results.length > 0 ? results : [{ 
        title: "DEBUG: Regex-Fallback fand nichts", image: "", href: "" 
    }]);
}
