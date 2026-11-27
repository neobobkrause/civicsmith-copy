/* The allocation counter the bounds tests share (image-codecs R12; R-CLOCK: a count, never a time). Not product code. */

/** A constructor the counter wraps: ArrayBuffer, or a typed array's (which state their element size).
 *  @typedef {ArrayBufferConstructor | Uint8ArrayConstructor | Int8ArrayConstructor | Uint16ArrayConstructor | Int16ArrayConstructor
 *    | Uint32ArrayConstructor | Int32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor | Uint8ClampedArrayConstructor} Allocator */

/** What a counted run handed back: its result (undefined if it threw), what it threw (undefined if it did not), and the peak.
 *  @template T
 *  @typedef {Object} Counted
 *  @property {T | undefined} result
 *  @property {unknown} error
 *  @property {number} peak */

/** The constructors counted, by global name, as they stand when called (read at each call, as the globals were),
 *  each with the bytes one element of it takes (its BYTES_PER_ELEMENT, which the language fixes; ArrayBuffer's length is in bytes).
 *  @returns {Array<[string, Allocator, number]>} */
function allocators() {
  return [["ArrayBuffer", ArrayBuffer, 1], ["Uint8Array", Uint8Array, 1], ["Int8Array", Int8Array, 1], ["Uint16Array", Uint16Array, 2],
    ["Int16Array", Int16Array, 2], ["Uint32Array", Uint32Array, 4], ["Int32Array", Int32Array, 4], ["Float32Array", Float32Array, 4],
    ["Float64Array", Float64Array, 8], ["Uint8ClampedArray", Uint8ClampedArray, 1]];
}

/** Wrap each counted constructor in globalThis so it records into `counted`; answer the originals, to put back.
 *  @param {{ peak: number }} counted @returns {Map<string, Allocator>} */
function wrap(counted) {
  const list = allocators();
  const saved = new Map(list.map(([n, Orig]) => {
    /** @type {[string, Allocator]} */
    const original = [n, Orig];
    return original;
  }));
  for (const [n, Orig, elementBytes] of list) {
    Reflect.set(globalThis, n, new Proxy(Orig, {
      /** @param {unknown[]} args */
      construct(target, args, newTarget) {
        const first = args[0];
        if (typeof first === "number") counted.peak = Math.max(counted.peak, first * elementBytes);
        return Reflect.construct(target, args, newTarget);
      },
    }));
  }
  return saved;
}

/** Put back the constructors `wrap` saved. @param {Map<string, Allocator>} saved @returns {void} */
function unwrap(saved) {
  for (const [n, O] of saved) Reflect.set(globalThis, n, O);
}

/** Run `fn`; answer what it returned or threw, and the most bytes any one typed array or buffer asked for while it ran
 *  (the constructors are wrapped for the length of the call, then put back).
 *  @template T @param {() => T} fn @returns {Counted<T>} */
export function peakAllocation(fn) {
  const counted = { peak: 0 };
  const saved = wrap(counted);
  /** @type {T | undefined} */ let result;
  /** @type {unknown} */ let error;
  try { result = fn(); } catch (e) { error = e; } finally { unwrap(saved); }
  return { result, error, peak: counted.peak };
}

/** The same for an async `fn`: the wrap holds until its promise settles.
 *  @template T @param {() => Promise<T>} fn @returns {Promise<Counted<T>>} */
export async function peakAllocationAsync(fn) {
  const counted = { peak: 0 };
  const saved = wrap(counted);
  /** @type {T | undefined} */ let result;
  /** @type {unknown} */ let error;
  try { result = await fn(); } catch (e) { error = e; } finally { unwrap(saved); }
  return { result, error, peak: counted.peak };
}
