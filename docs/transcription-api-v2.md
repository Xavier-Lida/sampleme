# Transcription API v2 (spec)

Rétrocompatible avec la v1 : les champs existants restent obligatoires côté client actuel.

## Endpoint

`POST /api/transcribe`  
`Content-Type: multipart/form-data`  
Champ fichier : `audio` (max 25 Mo)

## Réponse succès (v2)

```json
{
  "status": "success",
  "bpm": 92,
  "timeSignature": { "beats": 4, "beatType": 4 },
  "key": "C major",
  "data": [
    {
      "pitch": "C4",
      "duration": "q",
      "isRest": false,
      "startBeat": 0,
      "onsetSec": 0.0,
      "offsetSec": 0.65,
      "velocity": 0.7
    }
  ],
  "error": null
}
```

## Champs racine (optionnels v2)

| Champ | Type | Description |
|-------|------|-------------|
| `bpm` | number | Tempo estimé de l'enregistrement |
| `timeSignature` | `{ beats, beatType }` | Mesure pour l'affichage |
| `key` | string | Tonalité, ex. `C major` |

## Champs note (optionnels v2)

| Champ | Type | Description |
|-------|------|-------------|
| `startBeat` | number | Position en temps fort depuis le début |
| `onsetSec` | number | Début en secondes dans l'audio source |
| `offsetSec` | number | Fin en secondes |
| `velocity` | number | Dynamique normalisée 0–1 |

Priorité côté client (`transcription-adapter.ts`) :

1. `startBeat` si présent  
2. sinon `onsetSec` converti via `bpm`  
3. sinon enchaînement séquentiel (comportement v1)

## Réponse erreur

```json
{
  "status": "error",
  "data": null,
  "error": "Message lisible"
}
```

## Phase quantification (futur)

Une fois `startBeat` / `onsetSec` disponibles, le client peut appliquer `quantizePartition(notes, strength)` avant affichage (voir `lib/music/quantize.ts`).
