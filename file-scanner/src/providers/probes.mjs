/* What R28's test sends through a tool's own adapter: the EICAR test file (scan, sandbox), a document with a macro
 * (cdr), the vendor's documented test address (url_reputation, in the descriptor), and a counts record of zeros
 * (log_sink). No capture is read. */
import { LOG_COUNT_KINDS } from '../limits.mjs';
/** @import { CountsRecord } from './descriptor.mjs' */

// The EICAR test file, assembled at run time so this module's own text never carries it whole.
const EICAR_PARTS = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', '-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'];
/** @returns {Uint8Array} */
export const eicar = () => new TextEncoder().encode(EICAR_PARTS.join(''));

// A minimal Word document with a macro project (`word/vbaProject.bin`, an AutoOpen stub): 1.4 KB.
const MACRO_DOCM = 'UEsDBBQAAAAIALm7R133vsWA+wAAAOABAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbIWRQVPDIBCF/wrD1QlED47jJOlB61F7qD9gA5sEhYUBGtt/L2mrB8fqEd5+772FZrV3ls0Yk/HU8mtRc4akvDY0tvx1+1TdcZYykAbrCVt+wMRXXbM9BEyssJRaPuUc7qVMakIHSfiAVJTBRwe5HOMoA6h3GFHe1PWtVJ4yUq7y4sG75hEH2NnM1vtyfeoR0SbOHk6DS1bLIQRrFOSiy5n0j5TqnCAKeZxJkwnpqgxw+WvColwOuMz1hv4p5lLlh8EoFHMPm+jfUOXF7KW8cjQa2QZifgZXUPnho5baq50rduLvTmfvBRHfiAMV/Zqgt1hUMPS1sjz+UPcJUEsDBBQAAAAIALm7R12b/TfqrQAAACkBAAALAAAAX3JlbHMvLnJlbHONzzsOwjAMBuCrRN5pWgaEUNMuCKkrKgewEjetaB5KwqO3JwMDRQyMtn9/luv2aWZ2pxAnZwVURQmMrHRqslrApT9t9sBiQqtwdpYELBShbeozzZjyShwnH1k2bBQwpuQPnEc5ksFYOE82TwYXDKZcBs09yitq4tuy3PHwacDaZJ0SEDpVAesXT//YbhgmSUcnb4Zs+nHiK5FlDJqSgIcLiqt3u8gs8KbmqxebF1BLAwQUAAAACAC5u0ddS4lBeKQAAADkAAAAEQAAAHdvcmQvZG9jdW1lbnQueG1sRY5BDoIwEEWv0nQvRRfGEAo7T4AHqO0ITehM06kit5diopv3M5nJ+9P27zCLFyT2hFoeq1oKQEvO46jlbbgeLlJwNujMTAharsCy79qlcWSfATCLTYDcLFpOOcdGKbYTBMMVRcBt96AUTN7GNKqFkouJLDBv/jCrU12fVTAeZVHeya0lY0EqyN0AnMWva/F5EkYEYxNVrSoHhWln3PmVqP+D3QdQSwMEFAAAAAgAubtHXXVmGb6xAAAAFQEAABwAAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzbc9BjsIwDAXQq0TeT11mgdCoKbuR2CEEBzCp22Zo4iiOENye7BgES/+v/yR321tYzJWzeokWVk0LhqOTwcfJwun4+7UBo4XiQItEtnBnhW3fHXihUic6+6SmGlEtzKWkH0R1MwfSRhLH2oySA5V65gkTuQtNjN9tu8b834BX0+wGC3k3rMAc74nf7OBdFpWxNE4Cyjh690nF65n2Wf7YlQpRnrhYeGbN2UfAvsOXd/oHUEsDBBQAAAAIALm7R10bYICBSQAAAF0AAAATAAAAd29yZC92YmFQcm9qZWN0LmJpbrtwXvDBwo1SDxlwAMeSkqLMpNKSVIUwp3i/xNxUBVsFpZCMzGKX/OTS3NS8EiVeruDSJAXH0pJ8/4LUPA1NXi7XvBQFoBgvFwBQSwECFAMUAAAACAC5u0dd977FgPsAAADgAQAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIALm7R12b/TfqrQAAACkBAAALAAAAAAAAAAAAAACAASwBAABfcmVscy8ucmVsc1BLAQIUAxQAAAAIALm7R11LiUF4pAAAAOQAAAARAAAAAAAAAAAAAACAAQICAAB3b3JkL2RvY3VtZW50LnhtbFBLAQIUAxQAAAAIALm7R111Zhm+sQAAABUBAAAcAAAAAAAAAAAAAACAAdUCAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzUEsBAhQDFAAAAAgAubtHXRtggIFJAAAAXQAAABMAAAAAAAAAAAAAAIABwAMAAHdvcmQvdmJhUHJvamVjdC5iaW5QSwUGAAAAAAUABQBEAQAAOgQAAAAA';
/** @returns {Uint8Array} */
export const macroDocument = () => Uint8Array.from(atob(MACRO_DOCM), (c) => c.charCodeAt(0));

/** A counts record of zeros for one hour ending at `now`. @param {number} now @returns {CountsRecord} */
export function zeroCounts(now) {
  const to = new Date(Math.floor(now / 1000) * 1000);
  return { period: { from: new Date(to.getTime() - 3_600_000).toISOString(), to: to.toISOString() },
    counts: Object.fromEntries(LOG_COUNT_KINDS.map((k) => [k, 0])) };
}
