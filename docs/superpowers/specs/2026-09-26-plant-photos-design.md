# Pflanzenfotos – Design

Datum: 2026-09-26

## Ziel

Statt des Emojis zeigt die App echte Fotos der Pflanzen. Nutzer können ein Foto
hochladen oder direkt mit der Kamera aufnehmen. Fotos liegen in Supabase Storage,
werden vor dem Upload clientseitig verkleinert und lassen sich im Verzeichnis
per Tap groß ansehen. Das Emoji bleibt als Fallback, wenn kein Foto vorhanden ist.

Entscheidungen:
- Ein Foto pro Pflanze.
- Fotos sind wie alle anderen Daten öffentlich lesbar/schreibbar (kein Login).
- Offline aufgenommene Fotos werden lokal gemerkt und beim Sync hochgeladen.

## 1. Datenmodell & Supabase

- `public.plants` erhält `photo_url TEXT` und `thumb_url TEXT` (Migration 2e in
  `sql/schema.sql`, `ADD COLUMN IF NOT EXISTS`).
- Storage-Bucket `plant-photos`, public. Pfade:
  - `full/<plantId>.jpg`
  - `thumb/<plantId>.jpg`
- Upload mit `upsert: true`; die gespeicherte URL erhält `?t=<timestamp>` als
  Cache-Buster, damit ein ersetztes Foto sofort sichtbar wird.
- Policies auf `storage.objects` für `bucket_id = 'plant-photos'`: anon darf
  select, insert, update, delete.
- Beim Löschen einer Pflanze werden beide Dateien best effort mitgelöscht;
  Fehler werden ignoriert.
- README: Hinweis, `sql/schema.sql` erneut im SQL-Editor auszuführen.

## 2. Bildverarbeitung & Offline-Sync

Neues Modul `js/photos.js`:

- `processImage(file)` → `{ full: Blob, thumb: Blob }`
  - Bild per `createImageBitmap(file, { imageOrientation: 'from-image' })`
    laden (EXIF-Rotation korrigiert); Fallback auf `<img>` falls nicht
    unterstützt.
  - Full: lange Seite max. 1200 px, JPEG Qualität 0.82.
  - Thumb: 160×160 px, mittig quadratisch zugeschnitten, JPEG 0.8.
  - Validierung: MIME `image/*`, max. 20 MB; sonst Toast und Abbruch.
- `uploadPhoto(plantId, { full, thumb })` → `{ photo_url, thumb_url }`.
- `deletePhoto(plantId)` löscht beide Objekte.
- `plantAvatarHtml(plant, sizeClass)` liefert das Markup für Foto (Thumbnail)
  oder Emoji-Fallback; wird von allen Ansichten genutzt.

Offline:

- IndexedDB `saparadise_photos`, Object Store `pending`, Key `plantId`,
  Wert `{ full, thumb }` (Blobs). localStorage ist für Bilder zu klein.
- Outbox (`verdant_outbox` in `js/db.js`) erhält zwei neue Operationen:
  - `{ op: 'photo', table: 'plants', id }` – Blobs aus IndexedDB laden,
    hochladen, `photo_url`/`thumb_url` an der Pflanze setzen, Pflanze upserten,
    IndexedDB-Eintrag löschen.
  - `{ op: 'photo-delete', table: 'plants', id }` – Storage-Objekte löschen.
- Beim Speichern mit Foto: wenn online → direkt hochladen; bei Fehler oder
  offline → Blobs in IndexedDB, Outbox-Eintrag, `plant.photo_pending = true`.
- Anzeige vor dem Sync: Renderer erzeugt aus dem IndexedDB-Blob eine
  `blob:`-URL (In-Memory-Cache pro plantId), damit das Foto sofort sichtbar ist.
- `flushOutbox` verarbeitet `photo`-Einträge wie bisher: Stopp beim ersten
  Fehler, Toast bei Erfolg.

## 3. UI

Formular (Anlegen/Bearbeiten, `index.html` + `js/plants.js`):
- Oben ein runder Vorschaukreis (96 px) mit Foto oder Emoji.
- Daneben Buttons „Kamera" (`<input type="file" accept="image/*"
  capture="environment">`) und „Bild wählen" (`accept="image/*"`), sowie
  „Foto entfernen", wenn ein Foto vorhanden ist.
- Emoji-Feld bleibt darunter, Label „Symbol (Fallback)".
- Die gewählte Datei wird sofort verarbeitet und im Kreis angezeigt; Upload
  erfolgt beim Speichern. Während Verarbeitung/Upload ein Spinner im Kreis.

Verzeichnis (`js/plants.js`):
- 48 px rundes Thumbnail statt Emoji-Kreis. Tap öffnet die Lightbox.
- Ohne Foto: Emoji wie bisher, kein Tap-Verhalten.

Lightbox (`index.html` + `js/ui.js`):
- Overlay mit dunklem Hintergrund, Bild `object-contain`, max. 90 vw/vh,
  Pflanzenname darunter.
- Schließen per Tap außerhalb des Bildes, X-Button oder Esc. Zeigt `photo_url`.

Karte (`js/map.js`):
- Marker zeigt rundes Thumbnail mit weißem Rand statt Emoji.
- Auswahl-Editbox und Platzierungs-Picker nutzen ebenfalls `plantAvatarHtml`.

## Fehlerbehandlung

- Ungültige Datei / zu groß → Toast, Formular bleibt offen.
- Upload-Fehler → Foto in Outbox, Banner zeigt ausstehende Einträge.
- Fehlgeschlagenes Bild-Laden (`onerror`) → Emoji-Fallback anzeigen.

## Test

- Manuell im Browser: Datei wählen, Kamera (auf Handy), Foto ersetzen,
  Foto entfernen, Pflanze löschen (Storage-Objekte weg).
- DevTools offline: Foto speichern → Banner zeigt Ausstehend; online →
  Sync, Foto-URL gesetzt, IndexedDB leer.
- Headless-Screenshots von Verzeichnis, Karte und Formular mit/ohne Foto.
