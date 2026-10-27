// tvids.js

const baseUrl = "https://www.tvids.net";

/**
 * Hilfsfunktion für Netzwerkanfragen.
 * Nutzt fetchv2, da normales fetch in der Sora-Umgebung aufgrund von CORS fehlschlägt.
 */
async function soraFetch(url, options = {}) {
    const headers = options.headers || {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": baseUrl
    };
    const response = await fetchv2(url, headers, options.method || "GET", options.body || null);
    if (!response) throw new Error("Fehler beim Abrufen von: " + url);
    return response;
}

/**
 * Durchsucht die Website nach dem Schlüsselwort.
 * Rückgabe: JSON-Stringifiziertes Array von {title, image, href}
 */
async function searchResults(keyword) {
    const url = `${baseUrl}/search?q=${encodeURIComponent(keyword)}`;
    const html = await soraFetch(url);
    const results = [];
    
    // Regex zum Finden von Links zu watch/ oder movies/ Seiten
    const regex = /<a\s+href="\/(watch\d+\/[^"]+|movies\/[^"]+|show\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
        const href = match[1];
        // Bereinige den Titel von HTML-Tags
        let title = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        
        // Filtere irrelevante Treffer heraus
        if (title.length > 5 && !title.toLowerCase().includes("watch") && !title.toLowerCase().includes("online")) {
            results.push({
                title: title,
                href: `${baseUrl}/${href}`,
                image: "" // Kann bei Bedarf durch ein spezifisches <img> Regex ergänzt werden
            });
        }
    }
    
    // Duplikate entfernen
    const uniqueResults = [];
    const seen = new Set();
    for (const item of results) {
        if (!seen.has(item.href)) {
            seen.add(item.href);
            uniqueResults.push(item);
        }
    }
    
    return JSON.stringify(uniqueResults.slice(0, 30));
}

/**
 * Extrahiert Details zur Serie/Film (Beschreibung, Erscheinungsjahr).
 * Rückgabe: JSON-Stringifiziertes Objekt {description, aliases, airdate}
 */
async function extractDetails(url) {
    const html = await soraFetch(url);
    
    // Versuche, die Meta-Beschreibung oder den ersten aussagekräftigen Absatz zu finden
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) || 
                      html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : "Keine Beschreibung verfügbar.";
    
    // Versuche, das Erscheinungsjahr zu extrahieren
    const yearMatch = html.match(/Release:\s*<\/strong>\s*(\d{4})/i) || html.match(/(\d{4})/);
    const airdate = yearMatch ? yearMatch[1] : "Unbekannt";
    
    return JSON.stringify({
        description: description,
        airdate: airdate,
        aliases: []
    });
}

/**
 * Extrahiert die Liste der Episoden.
 * Rückgabe: JSON-Stringifiziertes Array von {href, number, title}
 */
async function extractEpisodes(url) {
    const html = await soraFetch(url);
    const episodes = [];
    
    // Suche nach Staffel-Blöcken (z.B. "Season 1")
    const seasonRegex = /Season\s+(\d+)([\s\S]*?)(?=Season\s+\d+|$)/g;
    let seasonMatch;
    
    while ((seasonMatch = seasonRegex.exec(html)) !== null) {
        const seasonNum = seasonMatch[1];
        const seasonContent = seasonMatch[2];
        
        // Suche nach Episoden-Links innerhalb des Staffel-Blocks
        const episodeRegex = /<a\s+href="\/(watch\d+\/[^"]+)"[^>]*>(E\d+\s+[^<]+)<\/a>/g;
        let epMatch;
        let epNum = 1;
        
        while ((epMatch = episodeRegex.exec(seasonContent)) !== null) {
            episodes.push({
                number: `S${seasonNum}E${String(epNum).padStart(2, '0')}`,
                title: epMatch[2].trim(),
                href: `${baseUrl}/${epMatch[1]}`
            });
            epNum++;
        }
    }
    
    // Fallback: Wenn keine Staffelstruktur gefunden wurde, suche nach allen watch-Links auf der Seite
    if (episodes.length === 0) {
        const fallbackRegex = /<a\s+href="\/(watch\d+\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let fbMatch;
        let num = 1;
        while ((fbMatch = fallbackRegex.exec(html)) !== null) {
            episodes.push({
                number: `Episode ${num}`,
                title: fbMatch[2].replace(/<[^>]+>/g, '').trim(),
                href: `${baseUrl}/${fbMatch[1]}`
            });
            num++;
        }
    }
    
    return JSON.stringify(episodes);
}

/**
 * Extrahiert die eigentliche Stream-URL (z.B. aus einem Iframe).
 * Rückgabe: JSON-Stringifiziertes Objekt {streams: [{title, streamUrl, headers?}], subtitles?}
 */
async function extractStreamUrl(url) {
    const html = await soraFetch(url);
    
    // TVids bettet Videos meist über Iframes von Drittanbietern ein
    const iframeMatch = html.match(/<iframe\s+[^>]*src=["']([^"']+)["']/i);
    
    if (iframeMatch && iframeMatch[1]) {
        let streamUrl = iframeMatch[1];
        // Stelle sicher, dass die URL ein vollständiger Pfad ist
        if (streamUrl.startsWith("//")) {
            streamUrl = "https:" + streamUrl;
        } else if (!streamUrl.startsWith("http")) {
            streamUrl = baseUrl + streamUrl;
        }
        
        return JSON.stringify({
            streams: [
                {
                    title: "Standard Server",
                    streamUrl: streamUrl,
                    headers: {
                        "Referer": baseUrl,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
                    }
                }
            ],
            subtitles: []
        });
    }
    
    // Fallback: Suche nach direkten <video> Tags
    const videoMatch = html.match(/<video[^>]*><source\s+src=["']([^"']+)["']/i);
    if (videoMatch) {
        return JSON.stringify({
            streams: [
                {
                    title: "Direkter Stream",
                    streamUrl: videoMatch[1],
                    headers: {
                        "Referer": baseUrl
                    }
                }
            ],
            subtitles: []
        });
    }
    
    throw new Error("Keine Stream-URL gefunden");
}
