// What the release writes into the image it publishes (R53, R59): Civicsmith's sealing public key with its key id
// (`ai-catalogue` R54's seal-key document, `{key_id, public_key}`, a raw X25519 key in base64), so the payload is sealed
// to a key the team does not hold. Until the release writes it, it is null and a run is refused SEALING_KEY_MISSING
// before anything is spent.
export const SEALING_KEY = null;
