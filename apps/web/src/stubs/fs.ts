// Browser stub for `fs` — the 0G storage SDK imports it at load, but the browser
// code paths (MemData / Blob, in-memory) never actually call into it.
const noop = () => {}
export const existsSync = () => false
export const mkdirSync = noop
export const readFileSync = () => Buffer.alloc(0)
export const writeFileSync = noop
export const appendFileSync = noop
export const unlinkSync = noop
export const statSync = () => ({ size: 0 })
export const createReadStream = noop
export const createWriteStream = noop
export default {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  unlinkSync,
  statSync,
  createReadStream,
  createWriteStream,
}
