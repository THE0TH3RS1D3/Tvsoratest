// Sora TVids Module
// Unterstützt Filme und Serien von tvids.to (tvids.net leitet weiter)

const BASE_URL = "https://www.tvids.to";

/**
 * Sucht nach Filmen und Serien auf TVids.
 * @param {string} keyword - Der Suchbegriff.
 * @returns {string} JSON-String mit einem Array von Suchergebnissen.
 */
async function searchResults(keyword) {
    try {
        const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(keyword)}`;
        const response = await fetchv2(searchUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const results = [];
        // Container für einzelne Suchergebnisse
        const items = doc.querySelectorAll("div.relative.text-gray-300");

        items.forEach((item) => {
            // Link zum Film/Serie
            const linkEl = item.querySelector("a[href*='/movies/'], a[href*='/watch']");
            if (!linkEl) return;

            const href = linkEl.getAttribute("href");
            // Titel aus dem zentrierten Text-Container
            const titleEl = item.querySelector("div.text-center a");
            const title = titleEl ? titleEl.textContent.trim() : "Unbekannt";

            // Poster-Bild (data-src wird von lazyload verwendet)
            const imgEl = item.querySelector("img");
            let image = "";
            if (imgEl) {
                image = imgEl.getAttribute("data-src") || imgEl.getAttribute("src") || "";
            }

            results.push({
                title: title,
                image: image,
                href: href // relativer oder absoluter Pfad
            });
        });

        return JSON.stringify(results);
    } catch (error) {
        console.error("TVids searchResults Fehler:", error);
        return JSON.stringify([{ title: "Fehler bei der Suche", image: "", href: "" }]);
    }
}

/**
 * Extrahiert Details (Beschreibung, Jahr, Typ) von einer Detailseite.
 * @param {string} key - Der Pfad (href) aus den Suchergebnissen.
 * @returns {string} JSON-String mit einem Array von Detail-Objekten.
 */
async function extractDetails(key) {
    try {
        const detailUrl = key.startsWith("http") ? key : `${BASE_URL}${key}`;
        const response = await fetchv2(detailUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Beschreibung aus dem Meta-Tag oder einem Absatz
        let description = "Keine Beschreibung verfügbar.";
        const metaDesc = doc.querySelector('meta[name="description"]');
        if (metaDesc) {
            description = metaDesc.getAttribute("content") || description;
        } else {
            const pEl = doc.querySelector("p");
            if (pEl) description = pEl.textContent.trim();
        }

        // Jahr und Typ aus dem Titel oder Meta-Daten ableiten
        const title = doc.title || "";
        let airdate = "N/A";
        const yearMatch = title.match(/(\d{4})/);
        if (yearMatch) airdate = yearMatch[1];

        let type = "Movie";
        if (detailUrl.includes("/watch")) type = "TV Series";
        else if (detailUrl.includes("/anime/")) type = "Anime";

        return JSON.stringify([{
            description: description,
            aliases: "N/A",
            airdate: airdate,
            type: type
        }]);
    } catch (error) {
        console.error("TVids extractDetails Fehler:", error);
        return JSON.stringify([{ description: "Fehler", aliases: "Fehler", airdate: "Fehler", type: "Fehler" }]);
    }
}

/**
 * Extrahiert die Stream-URLs von einer Detailseite.
 * TVids bettet Streams über verschiedene Drittanbieter ein.
 * Die URLs befinden sich in `url`-Attributen von Elementen mit der Klasse `sv`.
 * @param {string} key - Der Pfad (href) aus den Suchergebnissen.
 * @returns {string} JSON-String mit einem Array von Stream-Objekten.
 */
async function extractStreamUrl(key) {
    try {
        const detailUrl = key.startsWith("http") ? key : `${BASE_URL}${key}`;
        const response = await fetchv2(detailUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const streams = [];
        // Elemente mit Klasse "sv" enthalten die Stream-URLs im Attribut "url" oder "data-url"
        const streamEls = doc.querySelectorAll(".sv");

        streamEls.forEach((el) => {
            const streamUrl = el.getAttribute("url") || el.getAttribute("data-url");
            if (streamUrl && streamUrl.startsWith("http")) {
                // Vermeide Duplikate
                if (!streams.some((s) => s.url === streamUrl)) {
                    // Bestimme einen lesbaren Namen basierend auf der Domain
                    let hostname = "Unbekannt";
                    try {
                        hostname = new URL(streamUrl).hostname;
                    } catch (e) {}
                    streams.push({
                        name: hostname,
                        url: streamUrl
                    });
                }
            }
        });

        if (streams.length === 0) {
            return JSON.stringify([{ name: "Kein Stream gefunden", url: "" }]);
        }

        return JSON.stringify(streams);
    } catch (error) {
        console.error("TVids extractStreamUrl Fehler:", error);
        return JSON.stringify([{ name: "Fehler", url: "" }]);
    }
}
