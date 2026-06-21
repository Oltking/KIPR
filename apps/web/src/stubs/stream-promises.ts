// Browser stub for `stream/promises` — stream-browserify has no /promises subpath.
// The compute SDK imports it for Node stream pipelines that browser paths don't hit.
export const pipeline = async () => {
  throw new Error('stream/promises pipeline is not available in the browser.')
}
export const finished = async () => {
  throw new Error('stream/promises finished is not available in the browser.')
}
export default { pipeline, finished }
