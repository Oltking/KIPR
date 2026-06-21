// Browser stub for `fs/promises` — SDK's ZgFile imports { open } for Node uploads;
// the browser uses MemData / Blob instead, so these throw / no-op.
export const open = async () => {
  throw new Error('fs.open is unavailable in the browser — use MemData/Blob for uploads.')
}
export const readFile = async () => Buffer.alloc(0)
export const writeFile = async () => {}
export const mkdir = async () => {}
export default { open, readFile, writeFile, mkdir }
